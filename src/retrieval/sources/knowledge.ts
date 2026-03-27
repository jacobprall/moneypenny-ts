/**
 * Knowledge SearchSource — FTS5 + sqlite-vector (vector_full_scan) for chunks.
 * Uses sqliteai/sqlite-vector API: vector_init, vector_full_scan.
 */

import type { Database } from "bun:sqlite";
import type { SearchResult, SearchSourceOptions } from "../types";
import { embedTextAsBlob, initEmbeddingModel, isEmbeddingAvailable } from "../../pipeline/embedding";

export function createKnowledgeSource(db: Database) {
  return {
    id: "knowledge",
    async search(query: string, options: SearchSourceOptions): Promise<SearchResult[]> {
      const limit = options.limit;
      const minScore = options.minScore ?? 0;

      const results: SearchResult[] = [];
      const ftsResults: Array<{ id: string; content: string; rank: number }> = [];
      const vectorResults: Array<{ id: string; content: string; distance: number }> = [];

      // 1. FTS5 keyword search on chunks_fts
      try {
        const ftsRows = db
          .query(
            `SELECT c.id, c.content
             FROM chunks_fts
             JOIN chunks c ON c.rowid = chunks_fts.rowid
             WHERE chunks_fts MATCH ?
             LIMIT ?`
          )
          .all(query, limit) as Array<{ id: string; content: string }>;

        for (let i = 0; i < ftsRows.length; i++) {
          ftsResults.push({
            id: ftsRows[i].id,
            content: ftsRows[i].content,
            rank: 1 / (60 + i + 1), // RRF-style score
          });
        }
      } catch (e) {
        // FTS may fail if no match syntax
      }

      // 2. Vector search when embedding available (init model first)
      let embeddingReady = false;
      try {
        initEmbeddingModel(db);
        embeddingReady = isEmbeddingAvailable(db);
      } catch {
        // model not available
      }
      if (embeddingReady && options.queryEmbedding) {
        const queryBlob =
          options.queryEmbedding instanceof Buffer
            ? options.queryEmbedding
            : Buffer.from(options.queryEmbedding.buffer);
        try {
          const vectorRows = db
            .query(
              `SELECT c.id, c.content, v.distance
               FROM chunks c
               JOIN vector_full_scan('chunks', 'content_embedding', ?, ?) AS v ON c.rowid = v.rowid`
            )
            .all(queryBlob, limit) as Array<{ id: string; content: string; distance: number }>;

          for (const r of vectorRows) {
            vectorResults.push(r);
          }
        } catch (e) {
          // vector_full_scan may fail if no vectors or vector_init not run
        }
      } else if (embeddingReady) {
        // Embed query and run vector search
        const queryBlob = embedTextAsBlob(db, query);
        try {
          const vectorRows = db
            .query(
              `SELECT c.id, c.content, v.distance
               FROM chunks c
               JOIN vector_full_scan('chunks', 'content_embedding', ?, ?) AS v ON c.rowid = v.rowid`
            )
            .all(queryBlob, limit) as Array<{ id: string; content: string; distance: number }>;

          for (const r of vectorRows) {
            vectorResults.push(r);
          }
        } catch (e) {
          // ignore
        }
      }

      // 3. RRF-fuse: FTS list and vector list
      const ftsRanked = ftsResults.map((r, i) => ({ id: r.id, score: 1 / (60 + i + 1) }));
      const vecRanked = vectorResults.map((r, i) => ({
        id: r.id,
        score: 1 / (60 + i + 1),
      }));

      const fused = rrfFuseSimple([ftsRanked, vecRanked]);

      const idToContent = new Map<string, string>();
      for (const r of ftsResults) idToContent.set(r.id, r.content);
      for (const r of vectorResults) idToContent.set(r.id, r.content);

      const idToDistance = new Map<string, number>();
      for (const r of vectorResults) idToDistance.set(r.id, r.distance);

      for (let i = 0; i < Math.min(limit, fused.length); i++) {
        const item = fused[i];
        const content = idToContent.get(item.id) ?? "";
        const distance = idToDistance.get(item.id);
        const score = distance !== undefined ? 1 / (1 + distance) : item.score;
        if (score >= minScore) {
          results.push({
            id: item.id,
            content,
            score,
            store: "knowledge",
          });
        }
      }

      return results;
    },
  };
}

function rrfFuseSimple(rankedLists: Array<Array<{ id: string; score: number }>>): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();
  const RRF_K = 60;
  for (const list of rankedLists) {
    list.forEach((item, rank) => {
      const rrfScore = 1 / (RRF_K + rank + 1);
      scores.set(item.id, (scores.get(item.id) ?? 0) + rrfScore);
    });
  }
  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
