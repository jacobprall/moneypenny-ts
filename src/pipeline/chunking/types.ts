/**
 * Chunking strategy interface — pluggable strategies for splitting markdown into chunks.
 */

export interface Chunk {
  id: string;
  content: string;
  position: number;
}

export interface ChunkingStrategy {
  name: string;
  chunk(markdown: string): Chunk[];
}
