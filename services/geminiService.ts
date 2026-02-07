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
    Create a BOLD, FULL-CANVAS COMPOSITION SKETCH for: "${poseDescription}".
    
    CRITICAL INSTRUCTIONS:
    - FORCE A NEW PERSPECTIVE: Do not just draw a front-facing person. Use high angles, low angles, or side profiles as implied by the description.
    - DYNAMIC LINES: Use strong action lines. The pose must be distinct and readable.
    - MINIMALISM: Black thick lines on white background. No shading.
    - NO FACIAL DETAILS: Leave the face blank/empty.
    - NO TEXT/BORDERS: Do NOT draw a frame, do NOT write text, do NOT make a storyboard. Fill the entire aspect ratio with the subject.
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
    Generate a 100% PHOTOREALISTIC, LIFESTYLE PHOTOGRAPH by fusing the POSE from ${sketchIndex} with the IDENTITY from ${identityIndex}.

    [IDENTITY LOCK - CRITICAL]
    - The face in the output MUST be a 1:1 BIOLOGICAL CLONE of the person in ${identityIndex}.
    - Copy: Eye shape, eye color, nose structure, lip shape, mole placement, jawline.
    - If the reference image has imperfections (asymmetry, pores, scars), YOU MUST KEEP THEM. Do not "beautify" or "cartoonify" the face.
    - Skin Texture: Must be hyper-realistic. Visible pores, vellus hair, natural skin tone variation. NO PLASTIC SKIN.

    [CLOTHING BARRIER - ABSOLUTE LAW]
    - IGNORE the clothing in the reference image.
    - You MUST generate the outfit described in the prompt below with 100% FABRIC PHYSICS ACCURACY.
    - If prompt says "Wool Sweater", I need to see the fuzzy wool texture. If "Leather", I need to see the grain and specular highlights.
    - Do not blend the reference outfit into the new image.

    [HAIR PRESERVATION]
    - PRESERVE the Hair Color and Length from ${identityIndex}.
    - Style can match the prompt (e.g., messy bun), but volume and color must match the person.
    - NO BALD/SHAVED heads unless requested.
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
    - STYLE: Candid Lifestyle Photography (National Geographic / Vogue Editorial).
    - CAMERA: Shot on 35mm film (Kodak Portra 400 or Fujifilm simulation).
    - LIGHTING: Natural, motivated lighting. NO NEON. NO FANTASY GLOW.
    - TEXTURE: High frequency details. Clothing must look touchable.

    [NEGATIVE PROMPT]
    neon, cyberpunk, sci-fi, fantasy, drawing, sketch, illustration, 3d render, cgi, plastic skin, airbrushed, cartoon, anime, doll-like, smooth skin, glowing eyes, magic, sparks, studio background, deformed hands, floating limbs, text, watermark, border, frame, collage, character sheet, multiple views, split screen, bald, shaved head.
    `;
  } else {
    finalPrompt = `
    ${coreInstruction}
    ${anchorInstruction}
    
    Subject: ${config.prompt}
    Style: 8k resolution, photorealistic, cinematic lifestyle photography.
    
    [NEGATIVE PROMPT]
    neon, fantasy, cartoon, illustration, bald, shaved head, buzz cut, text, watermark, border, frame, paper, document, collage, character sheet, multiple angles, split view, cgi, 3d render.
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