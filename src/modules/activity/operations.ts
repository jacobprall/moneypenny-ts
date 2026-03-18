import type { OperationContext } from "../../core/context";
import { query as queryEvents } from "../../core/events";

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
