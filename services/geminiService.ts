
import { GoogleGenAI } from "@google/genai";
import { GenerationConfig, AspectRatio, ImageSize, AnchorImage } from "../types";
import { GLOBAL_NEGATIVE_PROMPT } from "../utils/datasetPlan";

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
    2. IF text contains "Side" or "Profile" -> Draw a figure facing 90° Right. NO EXCEPTIONS. Nose must be the furthest point.
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
// Implements Voltran Identity Synthesis with SMART GATING
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

  // --- 1. SKETCH REFERENCE (Structure) - ALWAYS FIRST ---
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
    imageMappingInfo.push(`- ${sketchIndex} (SKETCH - POSE/COMPOSITION BIBLE)`);
  }

  // --- 2. SMART REFERENCE GATING (The Filter) ---
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

  const p = config.prompt.toLowerCase();
  let specificIdentityInstruction = "";

  // SCENARIO: SIDE PROFILE (90 Degree)
  if (p.includes("side") || p.includes("profile") || p.includes("90 degree")) {
      // CRITICAL: DUMP THE FRONT VIEW. It confuses the model.
      addRef('side90', 'PRIMARY STRUCTURE - 90 DEGREE PROFILE');
      addRef('side', 'SECONDARY STRUCTURE - SIDE PROFILE');
      specificIdentityInstruction = "IGNORE FRONT VIEW. Copy the nose slope and jawline EXACTLY from the Side Profile reference.";

  // SCENARIO: BACK VIEW (No Face)
  } else if (p.includes("back") || p.includes("behind") || p.includes("walking away")) {
      // CRITICAL: SEND NO FACES. Only Body/Hair.
      addRef('threeQuarter', 'HAIR/BODY REF');
      addRef('side', 'HAIR REF'); 
      specificIdentityInstruction = "DO NOT DRAW A FACE. Subject is facing away. Focus on hair volume and shoulder structure.";

  // SCENARIO: EXPRESSION (Smile/Laugh)
  } else if (p.includes("smile") || p.includes("laugh") || p.includes("happy") || p.includes("joy")) {
      addRef('expression', 'EXPRESSION REFERENCE (TEETH/EYES)');
      addRef('front', 'IDENTITY BASE'); // We need front view for likeness, but expression guides the mouth.
      specificIdentityInstruction = "Morph the face from 'Image 1' into the smile seen in 'Expression Ref'.";

  // SCENARIO: STANDARD PORTRAIT (Default)
  } else {
      // Use Front view as bible.
      addRef('front', 'PRIMARY IDENTITY BIBLE');
      addRef('threeQuarter', 'DEPTH REF');
      specificIdentityInstruction = "Create a biological clone of 'Reference Image 1'.";
  }

  const refContextBlock = imageMappingInfo.join('\n');

  // --- REBALANCED PROMPT ENGINEERING ---
  let finalPrompt = "";

  const coreInstruction = `
    [TASK]
    This is NOT a creative generation task. This is a TEXTURE MAPPING task.
    You are given a Skeleton (Sketch Image 1) and a Skin Texture (Reference Images).
    
    [RULE 1: POSE OBEDIENCE]
    - IGNORE the pose in the Reference Photos. They are just for skin data.
    - You MUST align the body and head angle to match ${sketchIndex} exactly.
    - If the Sketch shows a back view, draw a back view, even if the Reference is a front view.

    [RULE 2: BIOLOGICAL CLONE]
    - The subject is "Lola kizil woman".
    - You must preserve: Eye distance, nose shape, lip volume, freckle pattern.
    - Do NOT "beautify" or "average" the face. Keep the specific quirks of the reference.
    - If the output does not look like the twin sister of the reference, it is a FAILURE.

    [INPUT CONTEXT]
    Use the following image map to understand the character's 3D geometry:
    ${refContextBlock}
    
    [IDENTITY LOGIC]
    ${specificIdentityInstruction}

    [BODY & OUTFIT]
    - IGNORE the clothes in the reference images. Use the outfit described below.
  `;

  if (config.isRawMode) {
    finalPrompt = `
    ${coreInstruction}

    [SCENE DESCRIPTION]
    ${config.prompt}

    [PHOTOGRAPHY SIGNATURE]
    - Shot on: Kodak Portra 400 Film (Medium Format).
    - Lens: Leica Summilux 50mm f/1.4.
    - Texture: VISIBLE FILM GRAIN, natural skin pores, vellus hair, slight motion blur on edges.
    - Lighting: Natural, imperfect, "available light". NO plastic studio gloss.
    - IMPERFECTIONS: Allow slight asymmetry, flyaway hairs, and natural skin texture variation.

    [NEGATIVE PROMPT]
    ${GLOBAL_NEGATIVE_PROMPT}
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
