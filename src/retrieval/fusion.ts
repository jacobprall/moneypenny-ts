/**
 * RRF (Reciprocal Rank Fusion) and MMR (Maximal Marginal Relevance) for result fusion.
 */

import type { SearchResult } from "./types";

const RRF_K = 60;

/** Reciprocal Rank Fusion: fuse multiple ranked lists by rank position. */
export function rrfFuse(rankedLists: Array<Array<{ id: string; score?: number }>>): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();

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

/** Jaccard-like similarity for MMR diversity (simplified: use score as relevance). */
function jaccardSim(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** MMR rerank: balance relevance and diversity. */
export function mmrRerank(
  results: SearchResult[],
  k: number,
  lambda = 0.5
): SearchResult[] {
  if (results.length <= k) return results;

  const selected: SearchResult[] = [];
  const remaining = [...results];

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const rel = remaining[i].score;
      let maxSim = 0;
      for (const s of selected) {
        const sim = jaccardSim(remaining[i].content, s.content);
        if (sim > maxSim) maxSim = sim;
      }
      const mmr = lambda * rel - (1 - lambda) * maxSim;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}
