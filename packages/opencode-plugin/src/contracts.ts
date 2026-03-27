/**
 * API contract types — keep aligned with my-moneypenny-js/src/api/http-types.ts
 * when publishing this package without the brain repo.
 */

export type PolicyEvaluateResult = {
  effect: "allow" | "deny" | "audit";
  matchedPolicy: { id: string; name: string } | null;
  reason: string;
};

export type SearchHit = { content: string; context?: string; score: number };

/** Optional `moneypenny` block in opencode.json (alongside `plugin`). */
export type MoneypennyFileConfig = {
  url?: string;
  context?: { enabled?: boolean; maxChars?: number; limit?: number };
  policy?: { enabled?: boolean };
  audit?: { enabled?: boolean };
  /** Extra substrings; if model `id` contains one, skip brain context injection. */
  skipModelSubstrings?: string[];
};
