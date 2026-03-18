/**
 * Knowledge repository — wraps documents table for backward compatibility.
 * New code should use pipeline/documents directly.
 */

import type { Database } from "bun:sqlite";
import * as docs from "../../pipeline/documents";

export interface KnowledgeEntry {
  id: string;
  sourceType: string;
  source: string | null;
  title: string | null;
  contentHash: string | null;
  context: string;
  metadata: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface NewKnowledgeEntry {
  id: string;
  sourceType: string;
  source?: string | null;
  title?: string | null;
  contentHash?: string | null;
  context: string;
  metadata?: string | null;
  status?: string;
  createdAt: number;
  updatedAt: number;
}

/** @deprecated Use runIngestPipeline for new documents. */
export function insert(db: Database, entry: NewKnowledgeEntry): void {
  docs.insertDocument(db, {
    id: entry.id,
    sourceType: entry.sourceType,
    source: entry.source ?? null,
    title: entry.title ?? null,
    contentHash: entry.contentHash ?? null,
    context: entry.context,
    metadata: entry.metadata ?? null,
    status: entry.status ?? "active",
    chunkCount: 0,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
}

export function list(
  db: Database,
  options: { sourceType?: string; limit?: number } = {}
): KnowledgeEntry[] {
  const rows = docs.listDocuments(db, options);
  return rows.map((r) => ({
    id: r.id,
    sourceType: r.sourceType,
    source: r.source,
    title: r.title,
    contentHash: r.contentHash,
    context: r.context,
    metadata: r.metadata,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export function getByContext(db: Database, context: string): KnowledgeEntry | null {
  const row = docs.getDocumentByContext(db, context);
  if (!row) return null;
  return {
    id: row.id,
    sourceType: row.sourceType,
    source: row.source,
    title: row.title,
    contentHash: row.contentHash,
    context: row.context,
    metadata: row.metadata,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function remove(db: Database, id: string): void {
  docs.deleteDocument(db, id);
}

export function removeByContext(db: Database, context: string): void {
  docs.deleteDocumentByContext(db, context);
}
