export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  caption: string; // For .txt file content
  timestamp: number;
  isDataset?: boolean;
  datasetId?: number; // Links back to DATASET_PLAN id
  isAnalyzing?: boolean; // True while Vision AI is generating the caption
}

export enum AspectRatio {
  SQUARE = "1:1",
  PORTRAIT = "3:4",
  LANDSCAPE = "4:3",
  TALL = "9:16",
  WIDE = "16:9"
}

export enum ImageSize {
  ONE_K = "1K",
  TWO_K = "2K",
  FOUR_K = "4K"
}

export interface GenerationConfig {
  prompt: string;
  referenceImage: string | null; // Base64 string
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  isRawMode?: boolean; // New flag for analog style
}

export interface DatasetItem {
  id: number;
  shot: string;
  expression: string;
  lighting: string;
  outfit: string;
  description: string;
}