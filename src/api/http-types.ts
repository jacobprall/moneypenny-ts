/**
 * Shared HTTP API types (used by transport + document contracts).
 * Keep in sync with @moneypenny/opencode-plugin contracts when publishing separately.
 */

export type PolicyEvaluateResult = {
  effect: "allow" | "deny" | "audit";
  matchedPolicy: { id: string; name: string } | null;
  reason: string;
};

export type SearchHit = { content: string; context?: string; score: number };
