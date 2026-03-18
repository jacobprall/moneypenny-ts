/**
 * Helper modules for user-defined operations (JS in DB).
 * DRY, SOLID, SRP — injectable into script context.
 */

import type { Database } from "bun:sqlite";
import { execute } from "../core/operations";

export interface ScriptContext {
  db: Database;
  actor: string;
  sessionId?: string;
  input: unknown;
}

/**
 * Execute another operation from within a user script.
 * The script receives helpers in its scope.
 */
export function createHelpers(ctx: ScriptContext) {
  return {
    execute(op: string, input: unknown) {
      return execute(op, input, {
        db: ctx.db,
        actor: ctx.actor,
        sessionId: ctx.sessionId,
      });
    },
    searchKnowledge(query: string, limit?: number) {
      return execute("knowledge.search", { query, limit }, {
        db: ctx.db,
        actor: ctx.actor,
        sessionId: ctx.sessionId,
      });
    },
    addFact(content: string, options?: { keywords?: string[]; context?: string }) {
      return execute("facts.add", { content, ...options }, {
        db: ctx.db,
        actor: ctx.actor,
        sessionId: ctx.sessionId,
      });
    },
    searchFacts(query: string, limit?: number) {
      return execute("facts.search", { query, limit }, {
        db: ctx.db,
        actor: ctx.actor,
        sessionId: ctx.sessionId,
      });
    },
  };
}
