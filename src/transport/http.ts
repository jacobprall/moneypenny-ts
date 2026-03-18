/// <reference types="bun-types" />
/**
 * Hono HTTP server — health check, API routes, future UI/SSE.
 */

import { Hono } from "hono";
import { getDb } from "../state";
import { execute } from "../core/operations";

const actor = "http";

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("Database not ready");
  return db;
}

export function createHttpApp() {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({ status: "ok", service: "brainstorm" });
  });

  app.get("/", (c) => {
    return c.json({
      name: "brainstorm",
      version: "0.1.0",
      endpoints: ["/health", "/api/events", "/api/jobs", "/api/policies", "/api/knowledge"],
    });
  });

  app.get("/api/events", async (c) => {
    try {
      const db = requireDb();
      const limit = parseInt(c.req.query("limit") ?? "100", 10);
      const operation = c.req.query("operation");
      const actorFilter = c.req.query("actor");
      const sessionId = c.req.query("sessionId");
      const result = await execute("activity.query", {
        operation,
        actor: actorFilter,
        sessionId,
        limit,
      }, { db, actor });
      return c.json(result);
    } catch (e) {
      if (e instanceof Error && e.message === "Database not ready") {
        return c.json({ error: "Database not ready" }, 503);
      }
      throw e;
    }
  });

  app.get("/api/jobs", async (c) => {
    try {
      const db = requireDb();
      const limit = parseInt(c.req.query("limit") ?? "100", 10);
      const result = await execute("jobs.list", { limit }, { db, actor });
      return c.json(result);
    } catch (e) {
      if (e instanceof Error && e.message === "Database not ready") {
        return c.json({ error: "Database not ready" }, 503);
      }
      throw e;
    }
  });

  app.get("/api/policies", async (c) => {
    try {
      const db = requireDb();
      const result = await execute("policy.list", {}, { db, actor });
      return c.json(result);
    } catch (e) {
      if (e instanceof Error && e.message === "Database not ready") {
        return c.json({ error: "Database not ready" }, 503);
      }
      throw e;
    }
  });

  app.get("/api/knowledge", async (c) => {
    try {
      const db = requireDb();
      const limit = parseInt(c.req.query("limit") ?? "100", 10);
      const sourceType = c.req.query("sourceType");
      const result = await execute("knowledge.list", { limit, sourceType }, { db, actor });
      return c.json(result);
    } catch (e) {
      if (e instanceof Error && e.message === "Database not ready") {
        return c.json({ error: "Database not ready" }, 503);
      }
      throw e;
    }
  });

  return app;
}

export function serveHttp(port = 3123): { server: ReturnType<typeof Bun.serve>; port: number } {
  const app = createHttpApp();
  const server = Bun.serve({
    fetch: app.fetch,
    port,
  });
  return { server, port: server.port ?? port };
}
