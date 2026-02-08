
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

            const cropScale = 0.55; // Slightly larger to capture full head shape, but strict on shoulders
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
// Prevents "Pose Contamination" (e.g. sending a side profile when asking for a front view).
const selectReferencesForContext = (
    refMap: ReferenceMap, 
    prompt: string
): { slot: string, data: string, method: 'crop' | 'full' }[] => {
    
    const promptLower = prompt.toLowerCase();
    const selectedRefs: { slot: string, data: string, method: 'crop' | 'full' }[] = [];

    // Detect Intent
    const isFrontView = promptLower.includes("front view") || promptLower.includes("mugshot") || promptLower.includes("looking directly");
    const isSideView = promptLower.includes("side profile") || promptLower.includes("side view") || promptLower.includes("90°");
    const isBackView = promptLower.includes("back view") || promptLower.includes("from behind");

    console.log(`[Context Logic] Intent detected: ${isFrontView ? 'FRONT' : isSideView ? 'SIDE' : 'GENERAL'}`);

    // LOGIC 1: FRONT VIEW REQUEST
    // Strict Rule: If we want Front View, DESTROY all Side/Angle references. They are poison.
    if (isFrontView) {
        if (refMap['front']) selectedRefs.push({ slot: 'front', data: refMap['front'], method: 'crop' });
        // We permit expression for texture, but crop it heavily
        if (refMap['expression']) selectedRefs.push({ slot: 'expression', data: refMap['expression'], method: 'crop' });
        
        // EXCLUDE: side, side90, threeQuarter
    }
    
    // LOGIC 2: SIDE VIEW REQUEST
    // Rule: We need the side profile structure.
    else if (isSideView) {
        // Prioritize Side Refs as FULL (we need the nose shape)
        if (refMap['side90']) selectedRefs.push({ slot: 'side90', data: refMap['side90'], method: 'full' });
        else if (refMap['side']) selectedRefs.push({ slot: 'side', data: refMap['side'], method: 'full' });
        
        // Add Front view ONLY for skin texture reference, but CROP IT so the AI doesn't try to rotate the head
        if (refMap['front']) selectedRefs.push({ slot: 'front', data: refMap['front'], method: 'crop' });
    }

    // LOGIC 3: GENERAL / LIFESTYLE
    // Rule: Use a mix, but prioritize Front for identity.
    else {
        if (refMap['front']) selectedRefs.push({ slot: 'front', data: refMap['front'], method: 'crop' });
        if (refMap['threeQuarter']) selectedRefs.push({ slot: 'threeQuarter', data: refMap['threeQuarter'], method: 'full' });
        if (refMap['expression']) selectedRefs.push({ slot: 'expression', data: refMap['expression'], method: 'crop' });
    }

    // Fallback: If logic filtered everything out (rare), just return front or whatever is available
    if (selectedRefs.length === 0 && refMap['front']) {
         selectedRefs.push({ slot: 'front', data: refMap['front'], method: 'crop' });
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
  // We don't blindly send all 5 images. We pick the ones that match the prompt's intent.
  const activeReferences = selectReferencesForContext(config.referenceImages, config.prompt);

  console.log(`[GeminiService] Using ${activeReferences.length} filtered references for generation.`);

  for (const ref of activeReferences) {
      let finalData = ref.data;
      if (ref.method === 'crop') {
          // Apply smart crop to isolate features
          const cropped = await cropToFaceFeature(ref.data);
          finalData = cropped.split(',')[1] || cropped;
      } else {
          finalData = ref.data.split(',')[1] || ref.data;
      }
      
      parts.push({
          inlineData: { mimeType: 'image/png', data: finalData }
      });
  }

  // 3. PROMPT ENGINEERING
  const isRaw = config.isRawMode;
  
  const finalPrompt = `
    [TASK]
    Render a photorealistic human based on the provided inputs.
    
    [INPUT MAPPING]
    - FIRST IMAGE is the POSE GUIDE (Sketch). You MUST align the skeleton to this sketch exactly.
    - SUBSEQUENT IMAGES are TEXTURE SAMPLES. Use them ONLY for skin tone, eye color, and hair color. IGNORE their pose.

    [STRICT ALIGNMENT]
    - If the Sketch (Image 1) shows a Front View, output a Front View, even if the texture samples are side profiles.
    - If the Sketch shows a Side View, output a Side View.
    - The Sketch is the Law for Geometry. The Texture Samples are the Law for Color.

    [CHARACTER DETAILS]
    Lola (Redhead, freckles, blue-green eyes).

    [SCENE]
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
