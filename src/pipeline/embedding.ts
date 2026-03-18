/**
 * Embedding via sqlite-ai + nomic-embed-text (GGUF).
 * 768 dimensions, FLOAT32 little-endian BLOB.
 */

import type { Database } from "bun:sqlite";
import { join } from "path";
import { existsSync } from "fs";
import { getModelsDir } from "../db/connection";

const EMBEDDING_DIM = 768;
const DEFAULT_MODEL = "nomic-embed-text-v1.5.Q8_0.gguf";

let modelLoaded = false;

export function isEmbeddingAvailable(db: Database): boolean {
  try {
    db.query("SELECT llm_embed_generate('test')").get();
    return true;
  } catch {
    return false;
  }
}

export function initEmbeddingModel(db: Database, modelPath?: string): void {
  if (modelLoaded) return;

  const path = modelPath ?? join(getModelsDir(), DEFAULT_MODEL);
  if (!existsSync(path)) {
    throw new Error(
      `Embedding model not found at ${path}. Run: bun run setup`
    );
  }

  db.run("SELECT llm_model_load(?)", [path]);
  db.run("SELECT llm_context_create_embedding('embedding_type=FLOAT32')");
  modelLoaded = true;
}

function toBuffer(blob: Buffer | Uint8Array | null | undefined): Buffer {
  if (!blob || blob.length === 0) {
    throw new Error("llm_embed_generate returned no result");
  }
  return blob instanceof Buffer ? blob : Buffer.from(blob);
}

export function embedText(db: Database, text: string): Float32Array {
  initEmbeddingModel(db);
  const row = db.query("SELECT llm_embed_generate(?) AS embedding").get(text) as { embedding?: Buffer | Uint8Array } | undefined;
  return blobToFloat32Array(toBuffer(row?.embedding));
}

export function embedTextAsBlob(db: Database, text: string): Buffer {
  initEmbeddingModel(db);
  const row = db.query("SELECT llm_embed_generate(?) AS embedding").get(text) as { embedding?: Buffer | Uint8Array } | undefined;
  return toBuffer(row?.embedding);
}

export function getEmbeddingDim(): number {
  return EMBEDDING_DIM;
}

function blobToFloat32Array(blob: Buffer): Float32Array {
  if (blob.length % 4 !== 0) {
    throw new Error(`Invalid embedding blob length: ${blob.length} (must be divisible by 4)`);
  }
  const arr = new Float32Array(blob.length / 4);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = blob.readFloatLE(i * 4);
  }
  return arr;
}
