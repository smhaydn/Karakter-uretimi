import { GoogleGenAI } from "@google/genai";
import { GenerationConfig, AspectRatio, ImageSize } from "../types";

// Helper to validate and get key
async function ensureApiKey(): Promise<string | undefined> {
  // Check if AI Studio method exists (runtime environment check)
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      // Logic to trigger selection is handled in UI, but here we can throw or return specific status
      return undefined;
    }
  }
  // In this specific environment, process.env.API_KEY is injected after selection
  return process.env.API_KEY;
}

export const generatePersonaImage = async (
  config: GenerationConfig
): Promise<string[]> => {
  const apiKey = await ensureApiKey();
  
  if (!apiKey) {
    throw new Error("API Key not selected. Please connect your Google account.");
  }

  // Create instance just before call to ensure fresh key
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];

  // Add reference image if exists (Multimodal prompting for "editing" or "variations")
  if (config.referenceImage) {
    // Extract base64 data (remove data:image/png;base64, prefix if present)
    const base64Data = config.referenceImage.split(',')[1] || config.referenceImage;
    const mimeType = config.referenceImage.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/png';

    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    });
  }

  // --- HYBRID REALISM ENGINE ---
  let finalPrompt = "";

  if (config.isRawMode) {
    // The "Hybrid Realism" Prompt Architecture
    // Adapts the physics of the user's "smartphone mirror" prompt but removes the phone/acne.
    finalPrompt = `
    [CAMERA & OPTICS]
    Phone-camera realism, slight edge softness, natural focus falloff, subtle sensor grain.
    Real daylight with slight warmth, natural contrast (not flat, not cinematic).
    Accurate white balance. True-to-life colors.
    
    [SKIN PHYSICS - CRITICAL]
    - Visible pores and fine micro-texture (must be visible).
    - Natural oil sheen only on high points (cheekbone, nose), matte elsewhere.
    - No symmetry correction.
    - Skin looks healthy and alive, not dull, not glossy-luminous.
    - FLAWLESS BUT TEXTURED: Remove acne/blemishes, but KEEP organic skin texture/pores.
    - Natural flyaways and baby hairs.

    [SUBJECT & SCENE]
    ${config.prompt}

    [STRICT NEGATIVES]
    NO 3D Render, NO Octane Render, NO Unreal Engine.
    NO faded colors, NO pastel tones, NO beige aesthetic.
    NO flat lighting, NO overexposed whites, NO AI glow.
    NO plastic skin, NO skincare-ad look, NO studio lighting.
    NO cartoon, anime, drawing, illustration.
    NO phone covering face (unless specified in scene).
    `;
  } else {
    // Fallback standard prompt
    finalPrompt = `${config.prompt}. Photorealistic, 8k, highly detailed, hyper-realistic, cinematic lighting.`;
  }

  parts.push({ text: finalPrompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', // Required for high quality 2K/4K
      contents: {
        parts: parts
      },
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
    // Handle the specific "Requested entity was not found" error for key reset
    if (error.message && error.message.includes("Requested entity was not found")) {
        throw new Error("API_KEY_INVALID"); 
    }
    throw error;
  }
};