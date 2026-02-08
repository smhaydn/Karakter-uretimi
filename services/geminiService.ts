
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
// Now acts as a Technical Storyboard Artist
export const generateSketch = async (
  poseDescription: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  const apiKey = await ensureApiKey();
  if (!apiKey) throw new Error("API Key not found");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Act as a Technical Storyboard Artist. DRAW A COMPOSITION SKETCH for: "${poseDescription}".

    [STRICT CAMERA RULES]
    1. IF text contains "Front" -> Draw a perfectly symmetrical stick figure facing forward.
    2. IF text contains "Side" or "Profile" -> Draw a figure facing 90° Right. NO EXCEPTIONS. The nose must be the furthest point.
    3. IF text contains "Back" -> Draw the back of the head.
    4. IF text contains "High Angle" -> Draw a grid on the floor to show perspective looking down.

    [STYLE]
    - Use thick, confident black markers.
    - NO FACES. Draw an oval with a cross (+) to indicate face direction.
    - NO SHADING. High contrast black & white only.
    - FILL THE CANVAS. Ensure the sketch matches the requested aspect ratio fully.
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
// Implements Voltran Identity Synthesis
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
  let imageIndexCounter = 1;
  const imageMappingInfo: string[] = [];

  // --- 1. SKETCH REFERENCE (Structure) ---
  let sketchIndex = "None";
  if (sketchReference) {
    const base64Sketch = sketchReference.split(',')[1] || sketchReference;
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Sketch
      }
    });
    sketchIndex = `Image ${imageIndexCounter}`;
    imageIndexCounter++;
  }

  // --- 2. MULTI-VIEW CHARACTER REFERENCES (Identity) ---
  // Iterate through slots and add available images
  const refMap = config.referenceImages;
  
  // Helper to add image part and log it for prompt
  const addRef = (slot: string, desc: string) => {
    const imgData = refMap[slot];
    if (imgData) {
        const base64 = imgData.split(',')[1] || imgData;
        parts.push({ inlineData: { mimeType: 'image/png', data: base64 } });
        imageMappingInfo.push(`- Image ${imageIndexCounter} (${desc})`);
        imageIndexCounter++;
    }
  };

  addRef('front', 'FRONT VIEW - PRIMARY LIKENESS');
  addRef('side', 'SIDE PROFILE - NOSE/JAW STRUCTURE');
  addRef('threeQuarter', '3/4 ANGLE - DEPTH');
  addRef('expression', 'EXPRESSION REF - SMILE/TEETH');
  addRef('side90', '90 DEGREE SIDE PROFILE - STRICT STRUCTURE');

  const refContextBlock = imageMappingInfo.join('\n');

  // --- VOLTRAN IDENTITY LOGIC ---
  // Analyze prompt to determine which reference is King
  let specificIdentityInstruction = "Use 'FRONT VIEW' as the primary facial reference, but map it onto the 3D structure implied by the Sketch.";
  
  const p = config.prompt.toLowerCase();
  if (p.includes("side") || p.includes("profile") || p.includes("90 degree")) {
      specificIdentityInstruction = "CRITICAL: For this Side View, disregard the Front View reference. STRICTLY COPY the nose shape and jawline from the '90 DEGREE SIDE PROFILE' or 'SIDE PROFILE' reference images.";
  } else if (p.includes("smile") || p.includes("laugh") || p.includes("happy") || p.includes("joy")) {
      specificIdentityInstruction = "CRITICAL: Use the 'EXPRESSION REF' image as the primary reference for teeth, mouth shape, and eye crinkles.";
  } else if (p.includes("back") || p.includes("behind")) {
      specificIdentityInstruction = "CRITICAL: Focus on the hair volume and shoulder structure. Do NOT force a face to be visible if the sketch shows a back view.";
  }

  // --- REBALANCED PROMPT ENGINEERING ---
  let finalPrompt = "";

  const coreInstruction = `
    [TASK]
    Create a highly photorealistic image of a specific character based on MULTIPLE reference inputs.
    
    [INPUT CONTEXT]
    Use the following image map to understand the character's 3D geometry:
    ${refContextBlock}
    ${sketchReference ? `- Use ${sketchIndex} ONLY for the pose composition/layout.` : ''}

    [IDENTITY SYNTHESIS (CRITICAL)]
    - You must construct a mental 3D model of this person by combining ALL the reference images provided.
    - ${specificIdentityInstruction}
    - Maintain consistent skin texture, moles, and eye distance across all angles.
    - DO NOT blend features with generic faces. It must look exactly like the reference person.

    [BODY & OUTFIT]
    - IGNORE the clothes in the reference images. Use the outfit described below.
    - Use the pose from ${sketchIndex} (if provided) or the text description.
  `;

  if (config.isRawMode) {
    finalPrompt = `
    ${coreInstruction}

    [SCENE DESCRIPTION]
    ${config.prompt}

    [STYLE GUIDE]
    - Candid Lifestyle Photography.
    - 35mm Film Look (Grain, slight imperfections).
    - Natural Lighting (No studio gloss unless specified).
    - Texture: Focus on fabric weaves and skin pores.

    [NEGATIVE PROMPT]
    cartoon, drawing, illustration, 3d render, plastic skin, airbrushed, neon, fantasy, sci-fi, cyberpunk, makeup, text, watermark, border, frame, split screen, multiple views, collage, deformed hands.
    `;
  } else {
    finalPrompt = `
    ${coreInstruction}
    
    Subject: ${config.prompt}
    Style: Photorealistic lifestyle photography.
    
    [NEGATIVE PROMPT]
    cartoon, illustration, low quality, blurry, text, watermark, border, frame, split screen, multiple views.
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
