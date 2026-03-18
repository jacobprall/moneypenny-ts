/**
 * Document and chunk repository — CRUD for documents/chunks tables.
 */

import type { Database } from "bun:sqlite";
import type { Chunk } from "./chunking/types";

export interface DocumentRow {
  id: string;
  sourceType: string;
  source: string | null;
  title: string | null;
  contentHash: string | null;
  context: string;
  metadata: string | null;
  status: string;
  chunkCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface NewDocument {
  id: string;
  sourceType: string;
  source?: string | null;
  title?: string | null;
  contentHash?: string | null;
  context: string;
  metadata?: string | null;
  status?: string;
  chunkCount?: number;
  createdAt: number;
  updatedAt: number;
}

export function insertDocument(db: Database, doc: NewDocument): void {
  db.run(
    `INSERT INTO documents (id, source_type, source, title, content_hash, context, metadata, status, chunk_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      doc.id,
      doc.sourceType,
      doc.source ?? null,
      doc.title ?? null,
      doc.contentHash ?? null,
      doc.context,
      doc.metadata ?? null,
      doc.status ?? "active",
      doc.chunkCount ?? 0,
      doc.createdAt,
      doc.updatedAt,
    ]
  );
}

export function insertChunks(db: Database, documentId: string, chunks: Chunk[]): void {
  const stmt = db.prepare(
    `INSERT INTO chunks (id, document_id, content, position, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const now = Date.now();
  for (const c of chunks) {
    stmt.run(c.id, documentId, c.content, c.position, now);
  }
  db.run("UPDATE documents SET chunk_count = ?, updated_at = ? WHERE id = ?", [
    chunks.length,
    now,
    documentId,
  ]);
}

export interface UnembeddedChunk {
  id: string;
  content: string;
}

export function chunksWithoutEmbedding(db: Database, limit: number): UnembeddedChunk[] {
  return db
    .query(
      `SELECT id, content FROM chunks WHERE content_embedding IS NULL LIMIT ?`
    )
    .all(limit) as UnembeddedChunk[];
}

export function setChunkEmbedding(
  db: Database,
  chunkId: string,
  blob: Buffer,
  model: string,
  hash?: string
): void {
  db.run(
    `UPDATE chunks SET content_embedding = ?, embedding_model = ?, embedding_hash = ? WHERE id = ?`,
    [blob, model, hash ?? null, chunkId]
  );
}

export function deleteDocument(db: Database, documentId: string): void {
  db.run("DELETE FROM chunks WHERE document_id = ?", [documentId]);
  db.run("DELETE FROM documents WHERE id = ?", [documentId]);
}

export function deleteDocumentByContext(db: Database, context: string): number {
  const docs = db.query("SELECT id FROM documents WHERE context = ?").all(context) as Array<{ id: string }>;
  for (const d of docs) {
    deleteDocument(db, d.id);
  }
  return docs.length;
}

export function listDocuments(
  db: Database,
  options: { sourceType?: string; limit?: number } = {}
): DocumentRow[] {
  const limit = options.limit ?? 100;
  let sql = `SELECT id, source_type as sourceType, source, title, content_hash as contentHash,
             context, metadata, status, chunk_count as chunkCount,
             created_at as createdAt, updated_at as updatedAt
             FROM documents WHERE status = 'active'`;
  const params: unknown[] = [];
  if (options.sourceType) {
    sql += " AND source_type = ?";
    params.push(options.sourceType);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  return db.query(sql).all(...params) as DocumentRow[];
}

export function getDocumentByContext(db: Database, context: string): DocumentRow | null {
  const row = db
    .query(
      `SELECT id, source_type as sourceType, source, title, content_hash as contentHash,
       context, metadata, status, chunk_count as chunkCount,
       created_at as createdAt, updated_at as updatedAt
       FROM documents WHERE context = ? AND status = 'active' LIMIT 1`
    )
    .get(context) as DocumentRow | undefined;
  return row ?? null;
}
