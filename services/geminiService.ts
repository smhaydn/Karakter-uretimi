
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

// --- UTILITY: SMART CROP ---
const cropToFaceFeature = async (base64Str: string): Promise<string> => {
    if (!base64Str) return "";
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

// --- UTILITY: REFERENCE SELECTOR ---
const selectReferencesForContext = (
    refMap: ReferenceMap, 
    prompt: string
): { refs: { slot: string, data: string, method: 'crop' | 'full' }[], instruction: string } => {
    
    const p = prompt.toLowerCase();
    const selectedRefs: { slot: string, data: string, method: 'crop' | 'full' }[] = [];
    let specificInstruction = "";

    const addRef = (slotId: string, method: 'crop' | 'full') => {
        const data = refMap[slotId];
        if (data && typeof data === 'string') {
            selectedRefs.push({ slot: slotId, data: data, method });
        }
    };

    console.log(`[Smart Gating] Analyzing Prompt: "${prompt.substring(0, 30)}..."`);

    if (p.includes("side") || p.includes("profile") || p.includes("90")) {
        addRef('side90', 'full'); 
        addRef('side', 'full');   
        specificInstruction = "IGNORE FRONT VIEW. Copy the nose slope and jawline EXACTLY from the Side Profile reference.";
    } else if (p.includes("back") || p.includes("behind")) {
        addRef('threeQuarter', 'full'); 
        addRef('side', 'full');         
        specificInstruction = "DO NOT DRAW A FACE. Subject is facing away. Focus on hair volume and shoulder structure.";
    } else if (p.includes("smile") || p.includes("laugh") || p.includes("happy")) {
        addRef('expression', 'crop'); 
        addRef('front', 'crop');      
        specificInstruction = "Morph the face from 'Image 1' into the smile seen in 'Expression Ref'.";
    } else {
        addRef('front', 'crop');        
        addRef('threeQuarter', 'full'); 
        specificInstruction = "Create a biological clone of 'Reference Image 1'.";
    }

    if (selectedRefs.length === 0 && refMap['front']) {
         addRef('front', 'crop');
    }

    return { refs: selectedRefs, instruction: specificInstruction };
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
    CRITICAL RULES: NO FACE DETAILS. The face must be an empty oval. SOLID BLACK LINES on WHITE background.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', 
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: aspectRatio, imageSize: "1K" } }
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
  
  if (sketchReference && typeof sketchReference === 'string' && sketchReference.includes(',')) {
    const base64Sketch = sketchReference.split(',')[1];
    parts.push({ inlineData: { mimeType: 'image/png', data: base64Sketch } });
  } else if (sketchReference && typeof sketchReference === 'string') {
    parts.push({ inlineData: { mimeType: 'image/png', data: sketchReference } });
  }

  const { refs: activeReferences, instruction: specificInstruction } = selectReferencesForContext(config.referenceImages, config.prompt);

  for (const ref of activeReferences) {
      if (!ref.data) continue; 

      let finalData = ref.data;
      if (ref.method === 'crop') {
          const cropped = await cropToFaceFeature(ref.data);
          finalData = (cropped && cropped.includes(',')) ? cropped.split(',')[1] : cropped;
      } else {
          finalData = (ref.data && ref.data.includes(',')) ? ref.data.split(',')[1] : ref.data;
      }
      
      if (finalData) {
        parts.push({ inlineData: { mimeType: 'image/png', data: finalData } });
      }
  }

  const isRaw = config.isRawMode;
  const finalPrompt = `
    [TASK] TEXTURE MAPPING task. Skeleton (Sketch) + Skin Texture (Refs).
    [RULE] Align body/head angle to SKETCH. Preserve Eye distance, nose shape, freckles from Refs.
    [INSTRUCTION] ${specificInstruction}
    [SCENE] ${config.prompt}
    [STYLE] ${isRaw ? "Analog photography, Kodak Portra 400, film grain." : "High-fidelity digital photography."}
    [NEGATIVE] ${GLOBAL_NEGATIVE_PROMPT}
  `;

  parts.push({ text: finalPrompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: parts },
      config: { imageConfig: { aspectRatio: config.aspectRatio, imageSize: config.imageSize } }
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
    if (error.message && error.message.includes("Requested entity was not found")) throw new Error("API_KEY_INVALID"); 
    throw error;
  }
};

// --- 3. AI CURATOR ---
export const evaluateImageQuality = async (imageBase64: string): Promise<number> => {
    if (!imageBase64 || typeof imageBase64 !== 'string') return 0;
    
    const apiKey = await ensureApiKey();
    if (!apiKey) return 0;
    const ai = new GoogleGenAI({ apiKey });
    
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const prompt = `Rate (1-10) for LoRA dataset: Anatomical correctness, texture realism. Return ONLY integer.`;

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
export const generateVisionCaption = async (imageBase64: string, triggerWord: string): Promise<string> => {
  if (!imageBase64 || typeof imageBase64 !== 'string') return "";
  
  const apiKey = await ensureApiKey();
  if (!apiKey) return "";
  const ai = new GoogleGenAI({ apiKey });
  
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const prompt = `Write a comma-separated caption. Start with: "${triggerWord}". Describe View, Subject, Pose, Outfit, Lighting.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ inlineData: { mimeType: 'image/png', data: base64Data } }, { text: prompt }] }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) { return ""; }
};
