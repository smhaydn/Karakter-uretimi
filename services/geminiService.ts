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
// Now more aggressive on dynamic poses
export const generateSketch = async (
  poseDescription: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  const apiKey = await ensureApiKey();
  if (!apiKey) throw new Error("API Key not found");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Create a HIGHLY DYNAMIC, EXAGGERATED gesture drawing or storyboard sketch for: "${poseDescription}".
    
    CRITICAL INSTRUCTIONS:
    - FORCE A NEW PERSPECTIVE: Do not just draw a front-facing person. Use high angles, low angles, or side profiles as implied by the description.
    - DYNAMIC LINES: Use strong action lines. The pose must be distinct and readable.
    - MINIMALISM: Black thick lines on white background. No shading.
    - NO FACIAL DETAILS: Leave the face blank/empty.
    - CROP: Ensure the sketch matches the requested aspect ratio fully.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', 
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "1K"
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

  // --- INPUTS ORDER MATTERS ---
  
  // 1. POSE REFERENCE (The Sketch) - Priority 1 for Composition
  if (sketchReference) {
    const base64Sketch = sketchReference.split(',')[1] || sketchReference;
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Sketch
      }
    });
  }

  // 2. PRIMARY IDENTITY REFERENCE (The User's Upload) - Priority 1 for Face
  if (config.referenceImage) {
    const base64Data = config.referenceImage.split(',')[1] || config.referenceImage;
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Data
      }
    });
  }

  // 3. ANCHOR REFERENCES (Consistency Feedback Loop)
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

  // --- STRICT PROMPT ENGINEERING ---
  let finalPrompt = "";
  
  // New "De-Coupling" Strategy
  const sketchIndex = sketchReference ? "Image 1" : "None";
  const identityIndex = sketchReference ? "Image 2" : "Image 1";
  const anchorStartIndex = sketchReference ? 3 : 2;

  const coreInstruction = `
    [TASK]
    Generate a photorealistic image by fusing the POSE from ${sketchIndex} with the IDENTITY from ${identityIndex}.

    [STRICT RULES - DO NOT BREAK]
    1. POSE SOURCE (${sketchIndex}): You MUST strictly follow the composition, camera angle, and body language of the Sketch.
    2. IDENTITY SOURCE (${identityIndex}): You MUST strictly copy the facial features (eyes, nose, mouth structure) from this image.
    3. SEPARATION: IGNORE the pose, background, and clothing of ${identityIndex}. ONLY take the face.
    4. VARIETY: The output must look COMPLETELY different from ${identityIndex} in terms of lighting, angle, and scenario.
  `;

  let anchorInstruction = "";
  if (anchorReferences && anchorReferences.length > 0) {
      anchorInstruction = `[IDENTITY ANCHORS (Images ${anchorStartIndex}+)]: Use these ONLY to confirm skin texture and mole placement. Ignore their poses.`;
  }

  if (config.isRawMode) {
    finalPrompt = `
    ${coreInstruction}
    ${anchorInstruction}

    [SCENE DESCRIPTION]
    ${config.prompt}

    [AESTHETIC & FILM LOOK]
    - Analog photography style, candid shot.
    - Imperfect framing, natural motion blur if applicable.
    - Skin texture: Visible pores, not plastic, not airbrushed.
    - Lighting: Must match the scene description, NOT the reference image.

    [NEGATIVE PROMPT]
    drawing, sketch, illustration, 3d render, plastic skin, same pose as reference, floating limbs, deformed hands.
    `;
  } else {
    finalPrompt = `
    ${coreInstruction}
    ${anchorInstruction}
    
    Subject: ${config.prompt}
    Style: 8k resolution, cinematic lighting, photorealistic, highly detailed.
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