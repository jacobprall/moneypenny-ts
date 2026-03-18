/**
 * Retrieval engine — fuse multiple sources, optional MMR rerank.
 */

import type { Database } from "bun:sqlite";
import type { SearchResult, RetrievalOptions } from "./types";
import { rrfFuse, mmrRerank } from "./fusion";
import { createKnowledgeSource } from "./sources/knowledge";

export async function retrieve(
  db: Database,
  query: string,
  options: RetrievalOptions = {}
): Promise<SearchResult[]> {
  const limit = options.limit ?? 10;
  const minScore = options.minScore ?? 0;
  const sources = options.sources ?? [createKnowledgeSource(db)];
  const weights = options.weights ?? {};
  const mmrLambda = options.mmrLambda ?? 0.5;

  const allResults: SearchResult[] = [];
  const rankedLists: Array<Array<{ id: string; score?: number }>> = [];

  for (const source of sources) {
    const queryEmbedding = options.queryEmbedding;
    const results = await source.search(query, {
      limit: limit * 2,
      queryEmbedding,
      minScore,
    });
    rankedLists.push(results.map((r) => ({ id: r.id, score: r.score })));
    for (const r of results) {
      const w = weights[source.id] ?? 1;
      allResults.push({ ...r, score: r.score * w });
    }
  }

  const fused = rrfFuse(rankedLists);
  const idToResult = new Map<string, SearchResult>();
  for (const r of allResults) {
    if (!idToResult.has(r.id) || r.score > (idToResult.get(r.id)?.score ?? 0)) {
      idToResult.set(r.id, r);
    }
  }

  const results: SearchResult[] = [];
  for (const { id } of fused.slice(0, limit * 2)) {
    const r = idToResult.get(id);
    if (r) results.push(r);
  }

  if (options.mmrLambda !== undefined && results.length > limit) {
    return mmrRerank(results, limit, mmrLambda);
  }

  return results.slice(0, limit);
}
