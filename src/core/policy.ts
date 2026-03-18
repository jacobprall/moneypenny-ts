/**
 * Policy engine — evaluate allow/deny/audit for operations.
 * Policies sync via CRDT; enforced locally.
 */

import type { Database } from "bun:sqlite";

export type PolicyEffect = "allow" | "deny" | "audit";

export interface Policy {
  id: string;
  name: string;
  effect: PolicyEffect;
  priority: number;
  actionPattern: string | null;
  resourcePattern: string | null;
  actorPattern: string | null;
  message: string | null;
  enabled: number;
}

export interface PolicyDecision {
  effect: PolicyEffect;
  matchedPolicy: Policy | null;
  reason: string;
}

function matchesPattern(pattern: string | null, value: string): boolean {
  if (!pattern) return true;
  try {
    const re = new RegExp(pattern);
    return re.test(value);
  } catch {
    return false;
  }
}

export function evaluatePolicy(
  db: Database,
  actor: string,
  action: string,
  resource: string,
  denyByDefault: boolean
): PolicyDecision {
  const rows = db
    .query(
      `SELECT id, name, effect, priority, action_pattern as actionPattern, resource_pattern as resourcePattern, actor_pattern as actorPattern, message, enabled
       FROM policies WHERE enabled = 1 ORDER BY priority DESC`
    )
    .all() as Policy[];

  for (const p of rows) {
    if (
      matchesPattern(p.actionPattern, action) &&
      matchesPattern(p.resourcePattern, resource) &&
      matchesPattern(p.actorPattern, actor)
    ) {
      return {
        effect: p.effect,
        matchedPolicy: p,
        reason: p.message ?? `Matched policy: ${p.name}`,
      };
    }
  }

  if (denyByDefault) {
    return {
      effect: "deny",
      matchedPolicy: null,
      reason: "No matching policy; deny by default",
    };
  }

  return {
    effect: "allow",
    matchedPolicy: null,
    reason: "No matching policy; allow by default",
  };
}
