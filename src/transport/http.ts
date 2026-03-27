/// <reference types="bun-types" />
/**
 * Hono HTTP server — health, brain API for OpenCode plugin + dashboard.
 */

import { Hono } from "hono";
import { execute } from "../core/operations";
import { context as brainContext } from "../session/brain-prompt";
import { BRAIN_PKG_VERSION } from "../version";
import {
  ContextPostBody,
  EventsAppendBody,
  FactsPostBody,
  FactsSearchBody,
  KnowledgeIngestBody,
  KnowledgeSearchBody,
  PolicyEvaluateBody,
} from "../api/http-schemas";
import {
  requireDbMiddleware,
  isPolicyDenied,
  zodErrorMessage,
  type BrainHttpVars,
} from "./http-middleware";

const actor = "http";

export function createHttpApp() {
  const app = new Hono();

  const apiEndpoints = [
    "/health",
    "/api/context",
    "/api/events",
    "/api/facts",
    "/api/facts/search",
    "/api/knowledge",
    "/api/knowledge/ingest",
    "/api/knowledge/search",
    "/api/jobs",
    "/api/policies",
    "/api/policy/evaluate",
  ];

  app.get("/health", (c) => {
    return c.json({ status: "ok", service: "moneypenny-brain", version: BRAIN_PKG_VERSION });
  });

  app.get("/", (c) => {
    return c.json({
      name: "moneypenny-brain",
      version: BRAIN_PKG_VERSION,
      endpoints: apiEndpoints,
    });
  });

  const api = new Hono<{ Variables: BrainHttpVars }>();
  api.use("*", requireDbMiddleware);

  /** Brain context block (GET: query param). */
  api.get("/context", async (c) => {
    try {
      const db = c.var.db;
      const query = c.req.query("q") ?? c.req.query("query") ?? "";
      if (!query.trim()) {
        return c.json({ context: "", query: "" });
      }
      const limit = parseInt(c.req.query("limit") ?? "5", 10);
      const maxChars = parseInt(c.req.query("maxChars") ?? "2000", 10);
      const context = await brainContext(db, "", query, { limit, maxChars });
      return c.json({ context, query });
    } catch (e) {
      if (e instanceof Error && e.message === "Database not ready") {
        return c.json({ error: "Database not ready" }, 503);
      }
      throw e;
    }
  });

  /** Brain context (POST — long queries). */
  api.post("/context", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const parsed = ContextPostBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: zodErrorMessage(parsed.error) }, 400);
    }
    const q = parsed.data.query ?? "";
    if (!q.trim()) {
      return c.json({ context: "", query: "" });
    }
    const limit = parsed.data.limit ?? 5;
    const maxChars = parsed.data.maxChars ?? 2000;
    const context = await brainContext(c.var.db, "", q, { limit, maxChars });
    return c.json({ context, query: q });
  });

  api.get("/events", async (c) => {
    const db = c.var.db;
    const limit = parseInt(c.req.query("limit") ?? "100", 10);
    const operation = c.req.query("operation");
    const actorFilter = c.req.query("actor");
    const sessionId = c.req.query("sessionId");
    const result = await execute(
      "activity.query",
      {
        operation,
        actor: actorFilter,
        sessionId,
        limit,
      },
      { db, actor }
    );
    return c.json(result);
  });

  api.post("/events", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const parsed = EventsAppendBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: zodErrorMessage(parsed.error) }, 400);
    }
    const b = parsed.data;
    try {
      const result = await execute(
        "activity.append",
        {
          operation: b.operation,
          actor: b.actor,
          sessionId: b.sessionId,
          input: b.input,
          output: b.output,
          error: b.error,
          durationMs: b.durationMs,
        },
        { db: c.var.db, actor, resource: "activity.append", sessionId: b.sessionId ?? undefined }
      );
      return c.json(result);
    } catch (e) {
      if (isPolicyDenied(e)) {
        return c.json({ error: (e as Error).message }, 403);
      }
      throw e;
    }
  });

  api.post("/facts", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const parsed = FactsPostBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: zodErrorMessage(parsed.error) }, 400);
    }
    const b = parsed.data;
    const keywords = Array.isArray(b.keywords)
      ? b.keywords
      : typeof b.keywords === "string"
        ? b.keywords.split(",").map((k) => k.trim()).filter(Boolean)
        : undefined;
    try {
      const result = await execute(
        "facts.add",
        {
          content: b.content,
          keywords,
          confidence: b.confidence,
        },
        { db: c.var.db, actor, sessionId: b.sessionId }
      );
      return c.json(result);
    } catch (e) {
      if (isPolicyDenied(e)) {
        return c.json({ error: (e as Error).message }, 403);
      }
      throw e;
    }
  });

  api.post("/facts/search", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const parsed = FactsSearchBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: zodErrorMessage(parsed.error) }, 400);
    }
    const b = parsed.data;
    const result = await execute(
      "facts.search",
      {
        query: b.query,
        limit: b.limit,
        minScore: b.minScore,
      },
      { db: c.var.db, actor, sessionId: b.sessionId }
    );
    return c.json(result);
  });

  api.post("/knowledge/ingest", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const parsed = KnowledgeIngestBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: zodErrorMessage(parsed.error) }, 400);
    }
    const b = parsed.data;
    const result = await execute(
      "knowledge.ingest",
      {
        source: b.source,
        url: b.url,
        path: b.path,
        content: b.content,
        context: b.context,
        title: b.title,
      },
      { db: c.var.db, actor, sessionId: b.sessionId }
    );
    return c.json(result);
  });

  api.post("/knowledge/search", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const parsed = KnowledgeSearchBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: zodErrorMessage(parsed.error) }, 400);
    }
    const b = parsed.data;
    const result = await execute(
      "knowledge.search",
      {
        query: b.query,
        limit: b.limit,
        minScore: b.minScore,
      },
      { db: c.var.db, actor, sessionId: b.sessionId }
    );
    return c.json(result);
  });

  api.get("/knowledge", async (c) => {
    const limit = parseInt(c.req.query("limit") ?? "100", 10);
    const sourceType = c.req.query("sourceType");
    const result = await execute("knowledge.list", { limit, sourceType }, { db: c.var.db, actor });
    return c.json(result);
  });

  api.get("/jobs", async (c) => {
    const limit = parseInt(c.req.query("limit") ?? "100", 10);
    const result = await execute("jobs.list", { limit }, { db: c.var.db, actor });
    return c.json(result);
  });

  api.get("/policies", async (c) => {
    const result = await execute("policy.list", {}, { db: c.var.db, actor });
    return c.json(result);
  });

  api.post("/policy/evaluate", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const parsed = PolicyEvaluateBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: zodErrorMessage(parsed.error) }, 400);
    }
    const b = parsed.data;
    const result = await execute(
      "policy.evaluate",
      {
        actor: b.actor,
        action: b.action,
        resource: b.resource,
        denyByDefault: b.denyByDefault,
      },
      { db: c.var.db, actor, sessionId: b.sessionId }
    );
    return c.json(result);
  });

  app.route("/api", api);

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
