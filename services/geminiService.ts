
import { GoogleGenAI } from "@google/genai";
import { GenerationConfig, AspectRatio, ImageSize, AnchorImage, ReferenceMap } from "../types";
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
const cropToFaceFeature = async (base64Str: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(base64Str);
                return;
            }

            const cropScale = 0.55; 
            const cropWidth = img.width * cropScale;
            const cropHeight = img.height * cropScale;

            const centerX = img.width / 2;
            const centerY = img.height / 2;
            const offsetYAdjustment = img.height * 0.05; 

            const startX = centerX - (cropWidth / 2);
            const startY = centerY - (cropHeight / 2) - offsetYAdjustment;

            canvas.width = cropWidth;
            canvas.height = cropHeight;

            ctx.drawImage(img, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (e) => {
            resolve(base64Str);
        };
        img.src = base64Str;
    });
};

// --- UTILITY: REFERENCE SELECTOR (THE DIRECTOR) ---
// Decides which reference slots to actually send to the AI based on the requested pose.
const selectReferencesForContext = (
    refMap: ReferenceMap, 
    prompt: string
): { slot: string, data: string, method: 'crop' | 'full' }[] => {
    
    const p = prompt.toLowerCase();
    const selectedRefs: { slot: string, data: string, method: 'crop' | 'full' }[] = [];

    const addRef = (slotId: string, method: 'crop' | 'full') => {
        if (refMap[slotId]) {
            selectedRefs.push({ slot: slotId, data: refMap[slotId]!, method });
        }
    };

    console.log(`[Smart Gating] Analyzing Prompt: "${prompt.substring(0, 30)}..."`);

    // SCENARIO 1: SIDE PROFILE (90 Degree)
    if (p.includes("side") || p.includes("profile") || p.includes("90")) {
        console.log(">> MODE: SIDE PROFILE (Removing Front View)");
        // CRITICAL: DUMP THE FRONT VIEW. It confuses the model.
        addRef('side90', 'full'); // Primary
        addRef('side', 'full');   // Fallback
        // Do NOT add front.
    } 
    
    // SCENARIO 2: BACK VIEW (No Face)
    else if (p.includes("back") || p.includes("behind")) {
        console.log(">> MODE: BACK VIEW (Removing Faces)");
        // CRITICAL: SEND NO FACES. Only Body/Hair.
        addRef('threeQuarter', 'full'); // Hair/Body Ref
        addRef('side', 'full');         // Hair Ref
        // Do NOT add front.
    }

    // SCENARIO 3: EXPRESSION (Smile/Laugh)
    else if (p.includes("smile") || p.includes("laugh") || p.includes("happy")) {
        console.log(">> MODE: EXPRESSION");
        addRef('expression', 'crop'); // The guide for the mouth
        addRef('front', 'crop');      // The guide for identity (cropped heavily)
    }

    // SCENARIO 4: STANDARD PORTRAIT (Default)
    else {
        console.log(">> MODE: STANDARD PORTRAIT");
        addRef('front', 'crop');        // Primary Identity Bible
        addRef('threeQuarter', 'full'); // Depth Ref
    }

    // Failsafe: If nothing selected, force Front
    if (selectedRefs.length === 0 && refMap['front']) {
         addRef('front', 'crop');
    }

    return selectedRefs;
}


// --- 1. AI SKETCH ARTIST ---
export const generateSketch = async (
  poseDescription: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  const apiKey = await ensureApiKey();
  if (!apiKey) throw new Error("API Key not found");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Create a minimalistic, black and white LINE DRAWING (Sketch) for: "${poseDescription}".
    
    CRITICAL RULES:
    1. NO FACE DETAILS. The face must be an empty oval.
    2. SOLID BLACK LINES on WHITE background.
    3. If description says "Front View", draw a symmetric body facing forward.
    4. If description says "Side View", draw a profile body facing right.
    5. High contrast. Stick-figure anatomy.
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

// --- 2. MULTI-REFERENCE GENERATION ---
export const generatePersonaImage = async (
  config: GenerationConfig,
  sketchReference?: string | null,
  anchorReferences?: AnchorImage[]
): Promise<string[]> => {
  const apiKey = await ensureApiKey();
  if (!apiKey) throw new Error("API Key not selected.");

  const ai = new GoogleGenAI({ apiKey });
  const parts: any[] = [];
  
  // 1. SKETCH (The Skeleton) - Always First
  if (sketchReference) {
    const base64Sketch = sketchReference.split(',')[1] || sketchReference;
    parts.push({
      inlineData: { mimeType: 'image/png', data: base64Sketch }
    });
  }

  // 2. SMART REFERENCE SELECTION (The Filter)
  const activeReferences = selectReferencesForContext(config.referenceImages, config.prompt);
  console.log(`[GeminiService] Using ${activeReferences.length} filtered references.`);

  for (const ref of activeReferences) {
      let finalData = ref.data;
      if (ref.method === 'crop') {
          const cropped = await cropToFaceFeature(ref.data);
          finalData = cropped.split(',')[1] || cropped;
      } else {
          finalData = ref.data.split(',')[1] || ref.data;
      }
      
      parts.push({
          inlineData: { mimeType: 'image/png', data: finalData }
      });
  }

  // 3. PROMPT ENGINEERING (Identity Lock)
  const isRaw = config.isRawMode;
  
  const finalPrompt = `
    [TASK]
    This is NOT a creative generation task. This is a TEXTURE MAPPING task.
    You are given a Skeleton (Sketch Image 1) and a Skin Texture (Reference Images).
    
    [RULE 1: POSE OBEDIENCE]
    - IGNORE the pose in the Reference Photos. They are just for skin data.
    - You MUST align the body and head angle to match SKETCH IMAGE 1 exactly.
    - If the Sketch shows a back view, draw a back view, even if the Reference is a front view.

    [RULE 2: BIOLOGICAL CLONE]
    - The subject is "Lola" (Redhead, freckles, blue-green eyes).
    - You must preserve: Eye distance, nose shape, lip volume, freckle pattern.
    - Do NOT "beautify" or "average" the face. Keep the specific quirks of the reference.

    [SCENE & LIGHTING]
    ${config.prompt}

    [STYLE]
    ${isRaw ? "Analog photography, Kodak Portra 400, film grain, natural skin texture." : "High-fidelity digital photography, sharp focus."}
    
    [NEGATIVE PROMPT]
    ${GLOBAL_NEGATIVE_PROMPT}
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
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
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

    const prompt = `Rate (1-10) for LoRA dataset: Anatomical correctness, texture realism, adherence to prompt. Return ONLY integer.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [{ inlineData: { mimeType: 'image/png', data: base64Data } }, { text: prompt }] }
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        const score = parseInt(text || "0", 10);
        return isNaN(score) ? 0 : score;
    } catch (error) { return 0; }
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
  
  const prompt = `Write a comma-separated caption for AI training. Start with: "${triggerWord}". Describe View, Subject, Pose, Outfit, Lighting.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ inlineData: { mimeType: 'image/png', data: base64Data } }, { text: prompt }] }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) { return ""; }
};
