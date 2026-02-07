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

  // --- RAW MODE PROMPT LOGIC ---
  let promptSuffix = "";

  if (config.isRawMode) {
    // The "Anti-AI" Prompt Recipe
    promptSuffix = `
      . Raw photo, shot on 35mm film, Kodak Portra 400, grainy texture.
      EXTREMELY DETAILED SKIN TEXTURE: visible pores, slight skin imperfections, tiny blemishes, natural skin variation, stray hairs, peach fuzz, natural eyebrows (not microbladed).
      Lighting: Natural, candid, unedited, sharp focus on eyes.
      NEGATIVE PROMPT / AVOID: smooth skin, airbrushed, plastic skin, cgi, 3d render, cartoon, anime, drawing, illustration, perfect skin, heavy makeup, symmetry.
    `;
  } else {
    // Fallback legacy prompt
    promptSuffix = `. Photorealistic, 8k, highly detailed, hyper-realistic, cinematic lighting.`;
  }

  const enhancedPrompt = `${config.prompt}${promptSuffix}`;
  parts.push({ text: enhancedPrompt });

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
