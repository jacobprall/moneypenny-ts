import type { OperationContext } from "../../core/context";
import { query as queryEvents, append as appendEvent } from "../../core/events";

export interface QueryInput {
  source?: "events" | "decisions" | "all";
  operation?: string;
  actor?: string;
  sessionId?: string;
  resource?: string;
  query?: string;
  limit?: number;
}

export interface QueryOutput {
  events: Array<{
    id: string;
    operation: string;
    actor: string;
    sessionId: string | null;
    input: string;
    output: string | null;
    error: string | null;
    durationMs: number | null;
    createdAt: number;
  }>;
}

export const query = {
  name: "activity.query",
  async execute(ctx: OperationContext, input: QueryInput): Promise<QueryOutput> {
    const source = input.source ?? "events";
    if (source === "decisions") {
      return { events: [] };
    }
    const filters = {
      operation: input.operation ?? input.resource,
      actor: input.actor,
      sessionId: input.sessionId,
      limit: input.limit ?? 100,
    };
    let events = queryEvents(ctx.db, filters);
    if (input.query) {
      const q = input.query.toLowerCase();
      events = events.filter((e) => {
        const inputStr = (e.input ?? "").toLowerCase();
        const outputStr = (e.output ?? "").toLowerCase();
        return inputStr.includes(q) || outputStr.includes(q);
      });
    }
    return {
      events: events.map((e) => ({
        id: e.id,
        operation: e.operation,
        actor: e.actor,
        sessionId: e.sessionId,
        input: e.input,
        output: e.output,
        error: e.error,
        durationMs: e.durationMs,
        createdAt: e.createdAt,
      })),
    };
  },
};

export interface AppendInput {
  operation: string;
  actor: string;
  sessionId?: string | null;
  input?: unknown;
  output?: unknown;
  error?: string | null;
  durationMs?: number | null;
}

export interface AppendOutput {
  id: string;
}

/**
 * Append a row to the audit `events` table (HTTP API / OpenCode plugin).
 * Runs through the full execute() pipeline: pre-hooks → policy → execute → post-hooks → audit.
 * With `deny_by_default`, add policies allowing `activity.append` for actor `http` (and plugin actors).
 */
export const append = {
  name: "activity.append",
  async execute(ctx: OperationContext, input: AppendInput): Promise<AppendOutput> {
    const id = crypto.randomUUID();
    appendEvent(ctx.db, {
      id,
      operation: input.operation,
      actor: input.actor,
      sessionId: input.sessionId ?? undefined,
      input: input.input ?? {},
      output: input.output,
      error: input.error ?? undefined,
      durationMs: input.durationMs ?? undefined,
      createdAt: Date.now(),
    });
    return { id };
  },
};
