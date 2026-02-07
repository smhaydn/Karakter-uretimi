export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
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
