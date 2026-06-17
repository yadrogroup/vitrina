export interface EmbeddingsFile {
  model: string;
  dim: number;
  items: Record<string, number[]>;
}

export interface RankedProduct {
  id: string;
  score: number;
}

export type SearchMode = 'text' | 'photo';

export interface PhotoSearchPayload {
  previewUrl: string;
  ranked: RankedProduct[];
}

export const PHOTO_SEARCH_STORAGE_KEY = 'vitrina-photo-search';
