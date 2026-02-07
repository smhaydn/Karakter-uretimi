export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  caption: string; // For .txt file content
  timestamp: number;
  isDataset?: boolean;
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
}

export interface DatasetItem {
  id: number;
  shot: string;
  expression: string;
  lighting: string;
  outfit: string;
  description: string;
}
