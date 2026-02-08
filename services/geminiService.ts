
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

// --- UTILITY: SMART CROP (THE POSE KILLER) ---
// Cuts out shoulders, neck, and background context, leaving only identity features.
// This forces the model to use the reference as a "Texture Map" rather than a "Pose Guide".
const cropToFaceFeature = async (base64Str: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; // Handle potential CORS if needed
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(base64Str); // Fallback
                return;
            }

            const size = Math.min(img.width, img.height);
            
            // AGGRESSIVE CROP STRATEGY:
            // We want to capture the eyes, nose, and mouth, but EXCLUDE the chin line, ears, and neck.
            // Excluding the neck/shoulders prevents "Pose Leakage" (model copying the stance).
            
            const cropScale = 0.50; // Keep only 50% of the center image. Very tight face crop.
            
            const cropWidth = img.width * cropScale;
            const cropHeight = img.height * cropScale; // Square crop

            // Calculate center
            const centerX = img.width / 2;
            const centerY = img.height / 2;

            // Shift slightly up to prioritize eyes over chin (Chin often implies head tilt)
            const offsetYAdjustment = img.height * 0.05; 

            const startX = centerX - (cropWidth / 2);
            const startY = centerY - (cropHeight / 2) - offsetYAdjustment;

            canvas.width = cropWidth;
            canvas.height = cropHeight;

            // Draw cropped version
            ctx.drawImage(img, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
            
            // Return new base64
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (e) => {
            console.warn("Crop failed, using original", e);
            resolve(base64Str);
        };
        img.src = base64Str;
    });
};

// --- 1. AI SKETCH ARTIST (Pass 1) ---
export const generateSketch = async (
  poseDescription: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  const apiKey = await ensureApiKey();
  if (!apiKey) throw new Error("API Key not found");
  const ai = new GoogleGenAI({ apiKey });

  // Simplified Prompt for faster/clearer sketching
  const prompt = `
    Create a high-contrast, black and white LINE DRAWING (Sketch) for this pose:
    "${poseDescription}"

    RULES:
    - Stick figure or wooden mannequin style.
    - NO FACIAL FEATURES. Blank face.
    - NO CLOTHES details. Focus on limb position and head angle.
    - If "Side View", draw profile facing right.
    - If "Front View", draw symmetric front.
    - White background, heavy black lines.
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
  const refMap = config.referenceImages;

  // --- A. SKETCH REFERENCE (THE SKELETON) ---
  // This is the primary guide for the POSE.
  let sketchInstruction = "No sketch provided.";
  if (sketchReference) {
    const base64Sketch = sketchReference.split(',')[1] || sketchReference;
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Sketch
      }
    });
    sketchInstruction = "IMAGE 1 is a POSE SKETCH. You MUST align the subject's body and head angle to match IMAGE 1 exactly.";
  }

  // --- B. IDENTITY REFERENCES (THE SKIN) ---
  // We use the "Smart Crop" logic here to prevent pose leakage.
  
  // 1. Front View (Essential) - CROPPED
  if (refMap['front']) {
      const croppedFront = await cropToFaceFeature(refMap['front']);
      parts.push({ 
          inlineData: { 
              mimeType: 'image/png', 
              data: croppedFront.split(',')[1] 
          } 
      });
  }

  // 2. Side/90 View (Optional) - FULL (Because side profile shape is needed for structure)
  // We don't crop side views as aggressively because the jawline shape is crucial geometry.
  if (refMap['side90'] || refMap['side']) {
      const sideRef = refMap['side90'] || refMap['side'];
      if (sideRef) {
          parts.push({ 
            inlineData: { 
                mimeType: 'image/png', 
                data: sideRef.split(',')[1] 
            } 
        });
      }
  }

  // --- C. PROMPT ENGINEERING (THE BRAIN) ---
  const isRaw = config.isRawMode;
  
  const finalPrompt = `
    [ROLE]
    You are an advanced texture-mapping AI. Your goal is to render a photorealistic person by combining a POSE SKETCH (Image 1) with ID TEXTURES (Other Images).

    [INPUT ANALYSIS]
    - IMAGE 1: The POSE GUIDE. (Skeleton). Follow this geometry strictly.
    - OTHER IMAGES: The ID TEXTURES. (Skin, Eyes, Hair Color). 
    - Note: The ID images are cropped close-ups. Do NOT copy their camera angle. Just take the features.

    [STRICT INSTRUCTION]
    1. Draw the character "Lola" (Redhead, fair skin, freckles).
    2. USE THE POSE from IMAGE 1. 
       - If Sketch looks left, Lola looks left.
       - If Sketch is far away, Lola is far away.
    3. APPLY THE FACE from the ID Images.
       - Transfer the freckle pattern, eye color (Green/Blue), and nose shape.
       - Do NOT transfer the "Front View" stare if the sketch is a "Side View".

    [SCENE & STYLE]
    ${config.prompt}

    [PHOTOGRAPHY SETTINGS]
    ${isRaw ? "Style: Analog Film, Kodak Portra 400. Grainy, imperfect, natural lighting." : "Style: High-end digital photography, sharp, studio lighting."}
    
    [NEGATIVE PROMPT]
    ${GLOBAL_NEGATIVE_PROMPT}, stiff pose, mugshot, passport photo, looking at camera (unless sketch does), 3d render, plastic skin.
  `;

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
          generatedImages.push(`data:image/png;base64,${part.inlineData.data}`);
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

// --- 3. AI CURATOR ---
export const evaluateImageQuality = async (
    imageBase64: string
): Promise<number> => {
    const apiKey = await ensureApiKey();
    if (!apiKey) return 0;
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = imageBase64.split(',')[1] || imageBase64;

    const prompt = `
        Rate this image (1-10) for a LoRA training dataset.
        Criteria:
        1. Is the face clear and anatomically correct?
        2. Are hands formed correctly (if visible)?
        3. Is it photorealistic?
        
        Return ONLY the integer number.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
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
        return 0;
    }
}

// --- 4. VISION CAPTIONING ---
export const generateVisionCaption = async (
  imageBase64: string,
  triggerWord: string
): Promise<string> => {
  const apiKey = await ensureApiKey();
  if (!apiKey) return "";
  const ai = new GoogleGenAI({ apiKey });
  const base64Data = imageBase64.split(',')[1] || imageBase64;
  
  const prompt = `
    Write a comma-separated caption for AI training.
    Start with: "${triggerWord}".
    Describe: View type, Subject details, Pose, Outfit, Lighting, Background.
    Keep it factual and visual.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
          { text: prompt }
        ]
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    return "";
  }
};
