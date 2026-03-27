/**
 * HTTP surface: status codes and JSON shapes clients rely on.
 * Does not start a real TCP server — uses Hono app.fetch.
 */

import { describe, expect, test } from "bun:test";
import { createHttpApp } from "../src/transport/http";
import { getDb, setDb } from "../src/state";
import { withIsolatedBrainDb } from "./support/harness";

describe("HTTP API", () => {
  test("GET /health is OK without a database", async () => {
    const app = createHttpApp();
    const res = await app.request("http://test/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service?: string };
    expect(body.status).toBe("ok");
  });

  test("GET /api/* returns 503 when no DB is bound", async () => {
    const prev = getDb();
    setDb(null);
    try {
      const res = await createHttpApp().request("http://test/api/policies");
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBeDefined();
    } finally {
      setDb(prev);
    }
  });

  test("GET /api/policies returns a list when DB is available", async () => {
    await withIsolatedBrainDb(false, async () => {
      const res = await createHttpApp().request("http://test/api/policies");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { policies?: unknown[] };
      expect(Array.isArray(body.policies)).toBe(true);
    });
  });

  test("POST /api/context rejects invalid numeric bounds with 400", async () => {
    await withIsolatedBrainDb(false, async () => {
      const res = await createHttpApp().request("http://test/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "hello", limit: -1 }),
      });
      expect(res.status).toBe(400);
      const err = (await res.json()) as { error?: string };
      expect(err.error).toContain("limit");
    });
  });

  test("POST /api/policy/evaluate returns an effect envelope", async () => {
    await withIsolatedBrainDb(false, async () => {
      const res = await createHttpApp().request("http://test/api/policy/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor: "a",
          action: "x",
          resource: "y",
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { effect: string; reason?: string };
      expect(["allow", "deny", "audit"]).toContain(body.effect);
    });
  });
});
