/**
 * Tool registry — built-in + brain tools.
 */

import type { Database } from "bun:sqlite";
import { tool } from "ai";
import { z } from "zod";
import { execute } from "../core/operations";

export interface ToolContext {
  db: Database;
  sessionId: string;
  messageId: string;
  callId: string;
  actor: string;
}

export type ToolDef = ReturnType<typeof tool>;

export function createBrainTools(ctx: ToolContext): Record<string, ToolDef> {
  const brainSearch = tool({
      description:
        "Search the brain's knowledge base and facts. Use when you need to recall stored information, project context, or prior decisions.",
      parameters: z.object({
        query: z.string().describe("Search query"),
        limit: z.number().optional().describe("Max results (default 10)"),
      }),
      execute: async (args) => {
        const result = await execute(
          "knowledge.search",
          { query: args.query, limit: args.limit ?? 10 },
          {
            db: ctx.db,
            actor: ctx.actor,
            sessionId: ctx.sessionId,
          }
        );
        const out = result as { results: Array<{ content: string; score: number }> };
        return {
          output: out.results
            .map((r) => `[score ${r.score.toFixed(2)}] ${r.content}`)
            .join("\n\n"),
        };
      },
    });

  const brainRemember = tool({
      description:
        "Store a fact in the brain for future sessions. Use for decisions, preferences, or context the user wants remembered.",
      parameters: z.object({
        content: z.string().describe("The fact to remember"),
        context: z.string().optional().describe("Optional context key"),
      }),
      execute: async (args) => {
        const result = await execute(
          "facts.add",
          { content: args.content, context: args.context },
          {
            db: ctx.db,
            actor: ctx.actor,
            sessionId: ctx.sessionId,
          }
        );
        return { output: `Remembered: ${(result as { id: string }).id}` };
      },
    });

  return {
    brain_search: brainSearch as unknown as ToolDef,
    brain_remember: brainRemember as unknown as ToolDef,
  };
}
