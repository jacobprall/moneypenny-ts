/**
 * Retrieval engine types — store-agnostic search sources.
 */

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  store: string;
  updatedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface SearchSourceOptions {
  limit: number;
  queryEmbedding?: Buffer | Float32Array;
  minScore?: number;
}

export interface SearchSource {
  id: string;
  search(query: string, options: SearchSourceOptions): Promise<SearchResult[]>;
}

export interface RetrievalOptions {
  limit?: number;
  minScore?: number;
  sources?: SearchSource[];
  weights?: Record<string, number>;
  queryEmbedding?: Buffer | Float32Array;
  mmrLambda?: number;
}
