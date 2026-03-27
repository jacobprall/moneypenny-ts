/**
 * MCP server (stdio transport) — tool routing to operations.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { join, resolve } from "path";
import { connect } from "../db";
import { getDb, setDb } from "../state";
import { execute, setDefaultDenyByDefault } from "../core/operations";
import { loadConfig } from "../core/config";
import { registerOperationTool, registerOperationToolAliases } from "./tools";
import { registerAllOperations } from "../register-operations";
import { startScheduler } from "../modules/jobs";
import { BRAIN_PKG_VERSION } from "../version";

const PING_RESPONSE = JSON.stringify({ ok: true, service: "moneypenny-brain" });

export async function runMcpServer(): Promise<void> {
  registerAllOperations();

  const config = await loadConfig();
  setDefaultDenyByDefault(config.denyByDefault);

  connect({ path: join(resolve(config.dataDir), "brain.db") })
    .then(async (d) => {
      setDb(d);
      startScheduler(d);
      const { startBackgroundSync } = await import("../sync/background");
      startBackgroundSync(d);
    })
    .catch((err) => console.error("Moneypenny brain DB init failed:", err));

  const server = new McpServer(
    { name: "moneypenny-brain", version: BRAIN_PKG_VERSION },
    { capabilities: { tools: {} } }
  );

  const actor = "mcp:client";

  for (const pingName of ["mp_ping", "brainstorm_ping"]) {
    server.registerTool(
      pingName,
      { description: "Check if Moneypenny brain is reachable.", inputSchema: {} },
      async () => ({ content: [{ type: "text" as const, text: PING_RESPONSE }] })
    );
  }

  registerOperationToolAliases(
    server,
    ["mp_knowledge", "brainstorm_knowledge"],
    {
      description: "Ingest and retrieve documents — long-term reference library.",
      actionDescribe: "add | search | list | ingest | delete",
      opMap: {
        add: "knowledge.add",
        search: "knowledge.search",
        list: "knowledge.list",
        ingest: "knowledge.ingest",
        delete: "knowledge.delete",
      },
    },
    getDb,
    actor
  );

  registerOperationToolAliases(
    server,
    ["mp_policy", "brainstorm_policy"],
    {
      description: "Manage policies — add, list, disable, evaluate.",
      actionDescribe: "add | list | disable | evaluate",
      opMap: { add: "policy.add", list: "policy.list", disable: "policy.disable", evaluate: "policy.evaluate" },
    },
    getDb,
    actor
  );

  registerOperationToolAliases(
    server,
    ["mp_activity", "brainstorm_activity"],
    {
      description: "Query session history and audit trail.",
      actionDescribe: "query",
      opMap: { query: "activity.query" },
    },
    getDb,
    actor
  );

  const executeTool = async ({ op, args = {} }: { op: string; args?: unknown }) => {
    const database = getDb();
    if (!database) throw new Error("Database not ready yet");
    const result = await execute(op, args, { db: database, actor });
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  };

  for (const name of ["mp_execute", "brainstorm_execute"]) {
    server.registerTool(
      name,
      {
        description: "Escape hatch for any canonical operation.",
        inputSchema: {
          op: z.string().describe("Operation name (e.g. jobs.create, knowledge.search)"),
          args: z.any().optional().describe("Operation-specific arguments"),
        },
      },
      executeTool
    );
  }

  registerOperationToolAliases(
    server,
    ["mp_hooks", "brainstorm_hooks"],
    {
      description: "Manage hooks — add, list, disable.",
      actionDescribe: "add | list | disable",
      opMap: { add: "hooks.add", list: "hooks.list", disable: "hooks.disable" },
    },
    getDb,
    actor
  );

  registerOperationToolAliases(
    server,
    ["mp_jobs", "brainstorm_jobs"],
    {
      description: "Create, list, pause, and resume scheduled jobs.",
      actionDescribe: "create | list | pause | resume",
      opMap: { create: "jobs.create", list: "jobs.list", pause: "jobs.pause", resume: "jobs.resume" },
    },
    getDb,
    actor
  );

  registerOperationToolAliases(
    server,
    ["mp_session", "brainstorm_session"],
    {
      description: "Create and run sessions — LLM chat loop.",
      actionDescribe: "create | run | get",
      opMap: { create: "session.create", run: "session.run", get: "session.get" },
    },
    getDb,
    actor
  );

  registerOperationToolAliases(
    server,
    ["mp_facts", "brainstorm_facts"],
    {
      description: "CRUD for durable facts — persistent knowledge across sessions.",
      actionDescribe: "add | search",
      opMap: { add: "facts.add", search: "facts.search" },
    },
    getDb,
    actor
  );

  const operationsTool = async ({ action, input = {} }: { action: string; input?: unknown }) => {
    const database = getDb();
    if (!database) throw new Error("Database not ready yet");
    const inp = input as { name?: string; input?: unknown };
    if (action === "list") {
      const result = await execute("operations.list", {}, { db: database, actor });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
    if (action === "run" && inp.name) {
      const result = await execute("operations.run", { name: inp.name, input: inp.input ?? {} }, {
        db: database,
        actor,
        resource: `operation:${inp.name}`,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
    throw new Error("Unknown action or missing name for run");
  };

  for (const name of ["mp_operations", "brainstorm_operations"]) {
    server.registerTool(
      name,
      {
        description: "List or run user-defined operations.",
        inputSchema: {
          action: z.string().describe("list | run"),
          input: z.any().optional(),
        },
      },
      operationsTool
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
