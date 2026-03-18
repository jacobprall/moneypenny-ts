/**
 * Hook execution — run pre/post hooks from DB.
 * Hooks sync via CRDT; phases: pre:validation, pre:injection, post:transform, etc.
 */

import type { Database } from "bun:sqlite";

export interface HookContext {
  operation: string;
  actor: string;
  sessionId?: string;
  phase: string;
  input: unknown;
  output?: unknown;
}

export type HookAction = "continue" | "abort" | "mutate";

export interface HookResult {
  action: HookAction;
  input?: unknown;
  output?: unknown;
  reason?: string;
}

interface HookRow {
  id: string;
  name: string;
  phase: string;
  matchPattern: string;
  priority: number;
  script: string;
}

function matchesOperation(pattern: string, operation: string): boolean {
  try {
    return new RegExp(pattern).test(operation);
  } catch {
    return false;
  }
}

function runHookScript(script: string, ctx: HookContext): HookResult {
  const fn = new Function(
    "ctx",
    `
    const { operation, actor, sessionId, phase, input, output } = ctx;
    return (function() {
      ${script}
    })();
  `
  );
  const result = fn(ctx);
  if (result && typeof result === "object" && "action" in result) {
    return result as HookResult;
  }
  return { action: "continue" };
}

export function runHooks(
  db: Database,
  phase: string,
  operation: string,
  actor: string,
  sessionId: string | undefined,
  input: unknown,
  output?: unknown
): { input: unknown; output?: unknown; aborted: boolean; reason?: string } {
  const rows = db
    .query(
      `SELECT id, name, phase, match_pattern as matchPattern, priority, script
       FROM hooks WHERE enabled = 1 AND phase = ? ORDER BY priority DESC`
    )
    .all(phase) as HookRow[];

  let currentInput = input;
  let currentOutput = output;
  let aborted = false;
  let abortReason: string | undefined;

  for (const row of rows) {
    if (!matchesOperation(row.matchPattern, operation)) continue;

    const ctx: HookContext = {
      operation,
      actor,
      sessionId,
      phase,
      input: currentInput,
      output: currentOutput,
    };

    try {
      const result = runHookScript(row.script, ctx);
      if (result.action === "abort") {
        aborted = true;
        abortReason = result.reason ?? "Hook aborted";
        break;
      }
      if (result.action === "mutate") {
        if (result.input !== undefined) currentInput = result.input;
        if (result.output !== undefined) currentOutput = result.output;
      }
    } catch (e) {
      aborted = true;
      abortReason = e instanceof Error ? e.message : String(e);
      break;
    }
  }

  return {
    input: currentInput,
    output: currentOutput,
    aborted,
    reason: abortReason,
  };
}

export function getPrePhases(): string[] {
  return ["pre:validation", "pre:injection"];
}

export function getPostPhases(): string[] {
  return ["post:transform"];
}
