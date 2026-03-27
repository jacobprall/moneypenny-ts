import { tool } from "@opencode-ai/plugin/tool";
import type { BrainClient } from "./client.js";

export type BrainToolsCtx = {
  brainOk: () => Promise<boolean>;
  getBrain: () => BrainClient;
};

export function createBrainTools(ctx: BrainToolsCtx) {
  return {
    brain_search: tool({
      description:
        "Search the Moneypenny brain for facts and ingested knowledge. " +
        "Use for project context, conventions, and prior decisions the user stored explicitly.",
      args: {
        query: tool.schema.string().describe("What to search for"),
        limit: tool.schema.number().optional().describe("Max results per source (default 8)"),
      },
      async execute(args) {
        if (!(await ctx.brainOk())) {
          return "Brain unavailable. Run `mp serve` in the moneypenny-brain project.";
        }
        const limit = args.limit ?? 8;
        const brain = ctx.getBrain();
        const [facts, knowledge] = await Promise.all([
          brain.searchFacts(args.query, limit),
          brain.searchKnowledge(args.query, limit),
        ]);
        return JSON.stringify({ facts, knowledge }, null, 2);
      },
    }),

    brain_remember: tool({
      description:
        "Store a durable fact in the Moneypenny brain. Use when the user asks to remember something.",
      args: {
        content: tool.schema.string().describe("The fact to store"),
        keywords: tool.schema.string().optional().describe("Comma-separated keywords"),
        confidence: tool.schema.number().min(0).max(1).optional().describe("Confidence 0–1"),
      },
      async execute(args, execCtx) {
        if (!(await ctx.brainOk())) {
          return "Brain unavailable. Run `mp serve`.";
        }
        const keywords = args.keywords
          ?.split(",")
          .map((k) => k.trim())
          .filter(Boolean);
        const r = await ctx.getBrain().addFact({
          content: args.content,
          keywords: keywords?.length ? keywords : undefined,
          confidence: args.confidence,
          sessionId: execCtx.sessionID,
        });
        return r ? `Stored fact id=${r.id}` : "Failed to store fact (policy denied or error).";
      },
    }),

    brain_ingest: tool({
      description:
        "Ingest a URL, file path, or raw text into the Moneypenny knowledge base (chunked + searchable).",
      args: {
        source: tool.schema.union([
          tool.schema.literal("url"),
          tool.schema.literal("file"),
          tool.schema.literal("text"),
        ]),
        url: tool.schema.string().optional(),
        path: tool.schema.string().optional(),
        content: tool.schema.string().optional(),
        title: tool.schema.string().optional(),
      },
      async execute(args, execCtx) {
        if (!(await ctx.brainOk())) {
          return "Brain unavailable. Run `mp serve`.";
        }
        const r = await ctx.getBrain().ingest({
          source: args.source,
          url: args.url,
          path: args.path,
          content: args.content,
          title: args.title,
          sessionId: execCtx.sessionID,
        });
        return r
          ? `Ingested document id=${r.id}${r.title ? ` title=${r.title}` : ""}`
          : "Ingest failed (check inputs and policy).";
      },
    }),
  };
}
