/**
 * MCP tool registration helpers — reduce repetition.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { Database } from "bun:sqlite";
import { execute } from "../core/operations";

const ACTION_INPUT_SCHEMA = {
  action: z.string(),
  input: z.any().optional(),
};

function jsonContent(text: string) {
  return [{ type: "text" as const, text }];
}

/**
 * Register a tool that maps action → operation. Use for knowledge, facts, jobs, policy, hooks.
 */
export function registerOperationTool(
  server: McpServer,
  options: {
    name: string;
    description: string;
    actionDescribe: string;
    opMap: Record<string, string>;
    getResource?: (action: string, input: unknown) => string | undefined;
  },
  getDb: () => Database | null,
  actor: string
): void {
  const { name, description, actionDescribe, opMap, getResource } = options;
  server.registerTool(
    name,
    {
      description,
      inputSchema: {
        ...ACTION_INPUT_SCHEMA,
        action: z.string().describe(actionDescribe),
      },
    },
    async ({ action, input = {} }) => {
      const db = getDb();
      if (!db) throw new Error("Database not ready yet");
      const op = opMap[action];
      if (!op) throw new Error(`Unknown action: ${action}`);
      const resource = getResource?.(action, input);
      const result = await execute(op, input, { db, actor, resource });
      return { content: jsonContent(JSON.stringify(result, null, 2)) };
    }
  );
}

/** Register the same operation tool under multiple MCP names (e.g. `mp_*` + legacy `brainstorm_*`). */
export function registerOperationToolAliases(
  server: McpServer,
  names: string[],
  options: Omit<Parameters<typeof registerOperationTool>[1], "name">,
  getDb: () => Database | null,
  actor: string
): void {
  for (const name of names) {
    registerOperationTool(server, { ...options, name }, getDb, actor);
  }
}
