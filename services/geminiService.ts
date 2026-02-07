import { GoogleGenAI } from "@google/genai";
import { GenerationConfig, AspectRatio, ImageSize, AnchorImage } from "../types";

// Helper to validate and get key
async function ensureApiKey(): Promise<string | undefined> {
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      return undefined;
    }
  }
  return process.env.API_KEY;
}

// --- 1. AI SKETCH ARTIST (Pass 1) ---
export const generateSketch = async (
  poseDescription: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  const apiKey = await ensureApiKey();
  if (!apiKey) throw new Error("API Key not found");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Create a rough, minimalist charcoal or pencil sketch of the following pose: "${poseDescription}".
    
    CRITICAL INSTRUCTIONS:
    - Black lines on white background.
    - Focus ONLY on the body posture, limb placement, and composition.
    - DO NOT draw a detailed face (leave face blank or rough).
    - No shading, just outlines and gesture lines.
    - This will be used as a ControlNet-style structural reference.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', // Pro image model for sketching
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "1K" // Sketch doesn't need 4K
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
      return `data:image/png;base64,${response.candidates[0].content.parts[0].inlineData.data}`;
    }
    throw new Error("Failed to generate sketch");
  } catch (error) {
    console.error("Sketch Error:", error);
    throw error;
  }
};

// --- 2. MULTI-REFERENCE GENERATION (Pass 2) ---
export const generatePersonaImage = async (
  config: GenerationConfig,
  sketchReference?: string | null,
  anchorReferences?: AnchorImage[]
): Promise<string[]> => {
  const apiKey = await ensureApiKey();
  
  if (!apiKey) {
    throw new Error("API Key not selected. Please connect your Google account.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const parts: any[] = [];

  // 1. PRIMARY IDENTITY REFERENCE (The User's Upload)
  if (config.referenceImage) {
    const base64Data = config.referenceImage.split(',')[1] || config.referenceImage;
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Data
      }
    });
  }

  // 2. POSE REFERENCE (The AI Sketch)
  if (sketchReference) {
    const base64Sketch = sketchReference.split(',')[1] || sketchReference;
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Sketch
      }
    });
  }

  // 3. ANCHOR REFERENCES (Consistency Feedback Loop)
  // We take up to 2 anchors to avoid token/size limits while maintaining consistency
  if (anchorReferences && anchorReferences.length > 0) {
    anchorReferences.slice(0, 2).forEach(anchor => {
        const base64Anchor = anchor.url.split(',')[1] || anchor.url;
        parts.push({
            inlineData: {
                mimeType: 'image/png',
                data: base64Anchor
            }
        });
    });
  }

  // --- HYBRID REALISM ENGINE ---
  let finalPrompt = "";
  
  // Construct instructions based on inputs
  let refInstructions = "Image 1 is the PRIMARY IDENTITY (Face ID). Preserve facial features strictly.";
  if (sketchReference) {
      refInstructions += " Image 2 is the POSE STRUCTURE (Sketch). Copy this body posture exactly but render it as a real photo.";
  }
  if (anchorReferences && anchorReferences.length > 0) {
      const startIndex = sketchReference ? 3 : 2;
      refInstructions += ` Images ${startIndex}+ are STYLE & IDENTITY ANCHORS. Use them to ensure the character looks consistent with previous generations.`;
  }

  if (config.isRawMode) {
    finalPrompt = `
    [INPUT MAPPING]
    ${refInstructions}

    [CAMERA & OPTICS]
    Phone-camera realism, slight edge softness, natural focus falloff, subtle sensor grain.
    Real daylight with slight warmth, natural contrast.
    
    [SKIN PHYSICS - CRITICAL]
    - Visible pores and fine micro-texture.
    - Natural oil sheen only on high points.
    - FLAWLESS BUT TEXTURED: Remove acne, keep organic skin texture.
    - Natural flyaways and baby hairs.

    [SUBJECT & SCENE]
    ${config.prompt}

    [STRICT NEGATIVES]
    NO 3D Render, NO sketch lines in final output, NO drawing.
    NO faded colors, NO plastic skin.
    `;
  } else {
    finalPrompt = `
    ${refInstructions}
    ${config.prompt}. Photorealistic, 8k, highly detailed, hyper-realistic, cinematic lighting.
    `;
  }

  parts.push({ text: finalPrompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: parts },
      config: {
        imageConfig: {
          aspectRatio: config.aspectRatio,
          imageSize: config.imageSize
        }
      }
    });

    const generatedImages: string[] = [];

    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const base64Image = `data:image/png;base64,${part.inlineData.data}`;
          generatedImages.push(base64Image);
        }
      }
    }

    return generatedImages;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    if (error.message && error.message.includes("Requested entity was not found")) {
        throw new Error("API_KEY_INVALID"); 
    }
    throw error;
  }
};

// --- 3. AI CURATOR (The Judge) ---
export const evaluateImageQuality = async (
    imageBase64: string
): Promise<number> => {
    const apiKey = await ensureApiKey();
    if (!apiKey) return 0;
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = imageBase64.split(',')[1] || imageBase64;

    const prompt = `
        Act as a strict photography curator for a LoRA training dataset.
        Analyze this image and rate it from 1 to 10 based on these criteria:
        1. Anatomical Correctness (Hands, eyes, limbs must be perfect).
        2. Face Clarity (Sharp focus, distinct features).
        3. Photorealism (Lighting, texture).
        
        If the image has deformed hands, extra fingers, or blurred face, score it below 5.
        
        OUTPUT FORMAT: Just return the single number (integer). Example: 8
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview', // Vision capable model
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64Data } },
                    { text: prompt }
                ]
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        const score = parseInt(text || "0", 10);
        return isNaN(score) ? 0 : score;
    } catch (error) {
        console.error("Evaluation Error:", error);
        return 0;
    }
}

/**
 * Analyzes the generated image to create a perfect LoRA training caption.
 */
export const generateVisionCaption = async (
  imageBase64: string,
  triggerWord: string
): Promise<string> => {
  const apiKey = await ensureApiKey();
  if (!apiKey) return "";

  const ai = new GoogleGenAI({ apiKey });

  // Extract pure base64
  const base64Data = imageBase64.split(',')[1] || imageBase64;
  
  const prompt = `
    Analyze this image for AI image model training (LoRA/Flux dataset).
    Start the caption with the trigger word: "${triggerWord}".
    
    Format: Comma-separated tags and short phrases. Lowcase.
    
    Structure the caption in this order:
    1. Trigger word
    2. Shot type (e.g., close up, full body)
    3. Subject description (hair, ethnicity, gaze)
    4. Action/Pose
    5. Outfit (detailed)
    6. Environment/Background
    7. Lighting quality (e.g., hard shadow, soft window light)
    8. Technical details (e.g., blurry background, film grain, flash photography)
    
    Example output:
    ${triggerWord}, close up portrait of a woman, looking at camera, messy bun, wearing a grey hoodie, indoors, window light, hard shadows, film grain, high quality
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', // Using Pro for best vision analysis
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data
            }
          },
          { text: prompt }
        ]
      }
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("Caption Generation Error:", error);
    return ""; // Fallback to empty string (will keep original prompt-based caption)
  }
};