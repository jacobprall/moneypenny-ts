/**
 * KnowledgeStore interface — swappable implementation for knowledge storage/retrieval.
 *
 * @deprecated Replaced by documents/chunks pipeline + retrieval engine. Knowledge operations
 * now use runIngestPipeline, retrieve(), and documents repo directly. This interface is kept
 * for reference; no active implementation exists.
 */

export interface SearchOptions {
  limit?: number;
  minScore?: number;
}

export interface SearchResult {
  content: string;
  context: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeStore {
  add(content: string, context: string, metadata?: Record<string, unknown>): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  delete(context: string): Promise<void>;
  configure?(options: Record<string, unknown>): void;
}
