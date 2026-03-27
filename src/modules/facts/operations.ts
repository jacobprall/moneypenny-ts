import type { OperationContext } from "../../core/context";
import { execute } from "../../core/operations";

export interface AddInput {
  content: string;
  keywords?: string[];
  confidence?: number;
  context?: string;
}

export interface AddOutput {
  id: string;
  context: string;
}

export const add = {
  name: "facts.add",
  async execute(ctx: OperationContext, input: AddInput): Promise<AddOutput> {
    const context = input.context ?? `fact-${crypto.randomUUID()}`;
    const metadata: Record<string, unknown> = {};
    if (input.keywords) metadata.keywords = input.keywords;
    if (input.confidence !== undefined) metadata.confidence = input.confidence;
    return execute("knowledge.add", {
      content: input.content,
      context,
      sourceType: "user",
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    }, { db: ctx.db, actor: ctx.actor, sessionId: ctx.sessionId });
  },
};

export interface SearchInput {
  query: string;
  limit?: number;
  minScore?: number;
}

export interface SearchOutput {
  results: Array<{ content: string; context: string; score: number }>;
}

export const search = {
  name: "facts.search",
  async execute(ctx: OperationContext, input: SearchInput): Promise<SearchOutput> {
    return execute<SearchInput, SearchOutput>("knowledge.search", input, {
      db: ctx.db,
      actor: ctx.actor,
      sessionId: ctx.sessionId,
    });
  },
};
