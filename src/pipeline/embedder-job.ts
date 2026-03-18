/**
 * Background embedder — poll chunks without embeddings, embed via sqlite-ai, store.
 */

import type { Database } from "bun:sqlite";
import * as docs from "./documents";
import { embedTextAsBlob, initEmbeddingModel, isEmbeddingAvailable } from "./embedding";

const EMBEDDING_MODEL = "nomic-embed-text-v1.5";
const BATCH_SIZE = 10;

export async function runEmbedderBatch(db: Database): Promise<number> {
  try {
    initEmbeddingModel(db);
  } catch {
    return 0;
  }
  if (!isEmbeddingAvailable(db)) {
    return 0;
  }

  const unembedded = docs.chunksWithoutEmbedding(db, BATCH_SIZE);
  if (unembedded.length === 0) return 0;

  let count = 0;
  for (const chunk of unembedded) {
    try {
      const blob = embedTextAsBlob(db, chunk.content);
      docs.setChunkEmbedding(db, chunk.id, blob, EMBEDDING_MODEL);
      count++;
    } catch (e) {
      console.error(`Embedder failed for chunk ${chunk.id}:`, e);
    }
  }
  return count;
}
