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

  // Add text prompt
  // We enhance the prompt slightly to ensure high quality if the user input is brief
  const enhancedPrompt = `${config.prompt}. Photorealistic, 8k, highly detailed, hyper-realistic, cinematic lighting.`;
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