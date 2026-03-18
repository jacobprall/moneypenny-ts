/**
 * Ingest pipeline: Source → Fetch → Parse → Normalize → Chunk → Store
 * Returns immediately after storing; embeddings run async via background embedder.
 */

import type { Database } from "bun:sqlite";
import { createHash } from "crypto";
import { fetchUrl, fetchFile, passThroughText } from "./sources";
import { toMarkdown } from "./parsers";
import { normalize } from "./normalizer";
import { markdownSectionStrategy, type ChunkingStrategy } from "./chunking";
import * as docs from "./documents";

export interface IngestInput {
  source: "url" | "file" | "text";
  url?: string;
  path?: string;
  content?: string;
  context?: string;
  title?: string;
}

export interface IngestOutput {
  documentId: string;
  chunkCount: number;
  context: string;
}

export interface IngestOptions {
  chunkingStrategy?: ChunkingStrategy;
}

export async function runIngestPipeline(
  db: Database,
  input: IngestInput,
  options: IngestOptions = {}
): Promise<IngestOutput> {
  const strategy = options.chunkingStrategy ?? markdownSectionStrategy;

  const url = input.url ?? (typeof input.path === "string" && input.path.startsWith("http") ? input.path : undefined);
  const path = input.path && !input.path.startsWith("http") ? input.path : undefined;
  const source = input.source ?? (url ? "url" : path ? "file" : input.content ? "text" : undefined);

  let raw: Awaited<ReturnType<typeof fetchUrl>>;
  if (source === "url" && url) {
    raw = await fetchUrl(url);
  } else if (source === "file" && path) {
    raw = await fetchFile(path);
  } else if (source === "text" && input.content) {
    raw = passThroughText(input.content, input.title);
  } else {
    throw new Error("Invalid ingest input: need url, path, or content");
  }

  const markdown = toMarkdown(raw);
  const normalized = normalize(markdown);
  const chunks = strategy.chunk(normalized);
  const context = input.context ?? (url ?? path ?? `ingest-${crypto.randomUUID()}`);
  const documentId = crypto.randomUUID();
  const now = Date.now();
  const contentHash = createHash("sha256").update(normalized).digest("hex");

  docs.insertDocument(db, {
    id: documentId,
    sourceType: source ?? "text",
    source: url ?? path ?? null,
    title: input.title ?? (raw as { title?: string }).title ?? null,
    contentHash,
    context,
    status: "active",
    chunkCount: chunks.length,
    createdAt: now,
    updatedAt: now,
  });

  docs.insertChunks(db, documentId, chunks);

  return { documentId, chunkCount: chunks.length, context };
}
