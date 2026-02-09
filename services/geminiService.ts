
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

    // 1. PRODUCT REFERENCE CHECK (Priority: 1-4)
    // Checks for any product presence to trigger product mode logic
    let productCount = 0;
    for (let i = 1; i <= 4; i++) {
        if (refMap[`product${i}`]) {
            addRef(`product${i}`, 'full');
            productCount++;
        }
    }

    if (productCount > 0) {
        specificInstruction += ` CRITICAL TASK: The 'Product Refs' show the exact garment to be worn. Transfer the fabric texture, lace patterns, fit, and material physics from these images onto the subject. Use Product Ref 1 as the primary guide for shape, and others for detail. `;
    }

    // 2. POSE & FACE LOGIC
    if (p.includes("side") || p.includes("profile") || p.includes("90")) {
        addRef('side90', 'full'); 
        addRef('side', 'full');   
        specificInstruction += " IGNORE FRONT VIEW for facial structure. Copy the nose slope and jawline EXACTLY from the Side Profile reference.";
    } else if (p.includes("back") || p.includes("behind")) {
        addRef('threeQuarter', 'full'); 
        addRef('side', 'full');         
        specificInstruction += " DO NOT DRAW A FACE. Subject is facing away. Focus on hair volume and shoulder structure.";
    } else if (p.includes("smile") || p.includes("laugh") || p.includes("happy")) {
        addRef('expression', 'crop'); 
        addRef('front', 'crop');      
        specificInstruction += " Morph the face from 'Image 1' into the smile seen in 'Expression Ref'.";
    } else {
        addRef('front', 'crop');        
        addRef('threeQuarter', 'full'); 
        specificInstruction += " Create a biological clone of 'Reference Image 1'.";
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
  
  // SAFETY WRAPPER:
  // Check if any product slot is active to enable "Fashion Context"
  const isFashionContext = !!(config.referenceImages['product1'] || config.referenceImages['product2'] || config.referenceImages['product3'] || config.referenceImages['product4']);
  
  const safetyContext = isFashionContext 
    ? "CONTEXT: Professional Commercial Fashion Catalog. High-end e-commerce photography. Elegant, sophisticated, cinematic lighting. Focus on product texture and textile fidelity. Non-explicit, safe-for-work fashion editorial style." 
    : "";

  const finalPrompt = `
    [TASK] TEXTURE MAPPING & FASHION COMPOSITING. Skeleton (Sketch) + Face/Product Texture (Refs).
    [RULE] Align body/head angle to SKETCH. Preserve Eye distance, nose shape, freckles from Face Refs.
    ${safetyContext}
    [INSTRUCTION] ${specificInstruction}
    [SCENE] ${config.prompt}
    [STYLE] ${isRaw ? "Analog photography, Kodak Portra 400, film grain, soft natural texture." : "High-fidelity digital photography, 8k resolution, sharp focus."}
    [NEGATIVE] ${GLOBAL_NEGATIVE_PROMPT}
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
    if (response.candidates && response.candidates.length > 0) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                generatedImages.push(`data:image/png;base64,${part.inlineData.data}`);
            }
        }
    }

    if (generatedImages.length > 0) {
        return generatedImages;
    }
    throw new Error("No image generated");

  } catch (error) {
    console.error("Generation Error:", error);
    throw error;
  }
};

// --- 3. VISION CAPTIONING ---
export const generateVisionCaption = async (imageUrl: string, triggerWord: string): Promise<string> => {
    const apiKey = await ensureApiKey();
    if (!apiKey) return "API Key missing";

    const ai = new GoogleGenAI({ apiKey });
    
    // Clean base64
    const base64Data = imageUrl.includes(',') ? imageUrl.split(',')[1] : imageUrl;

    const prompt = `
        Describe this image for a Stable Diffusion LoRA training dataset. 
        Start with the trigger word: "${triggerWord}". 
        Describe the subject's pose, expression, clothing, lighting, and background in detail. 
        Keep it comma-separated and concise.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64Data } },
                    { text: prompt }
                ]
            }
        });
        return response.text || "";
    } catch (e) {
        console.error("Caption Error", e);
        return "";
    }
}

// --- 4. IMAGE EVALUATION ---
export const evaluateImageQuality = async (imageUrl: string): Promise<number> => {
     const apiKey = await ensureApiKey();
     if (!apiKey) return 0;
 
     const ai = new GoogleGenAI({ apiKey });
     
     // Clean base64
     const base64Data = imageUrl.includes(',') ? imageUrl.split(',')[1] : imageUrl;
 
     const prompt = `
         Act as a professional photography critic. Rate this image on a scale of 1 to 10 based on:
         1. Photorealism (Is it distinguishable from a real photo?)
         2. Anatomical correctness (Hands, eyes, proportions)
         3. Lighting and Texture quality.
         
         Return ONLY the number (e.g., 8).
     `;
 
     try {
         const response = await ai.models.generateContent({
             model: 'gemini-3-flash-preview',
             contents: {
                 parts: [
                     { inlineData: { mimeType: 'image/png', data: base64Data } },
                     { text: prompt }
                 ]
             }
         });
         
         const text = response.text || "0";
         const score = parseInt(text.replace(/[^0-9]/g, ''));
         return isNaN(score) ? 5 : score;
     } catch (e) {
         console.error("Evaluation Error", e);
         return 0;
     }
}
