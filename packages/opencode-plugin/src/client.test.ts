/**
 * BrainClient: outcomes for success and failure responses from the brain HTTP API.
 * Uses injected fetch — no real server.
 */
import { describe, expect, mock, test } from "bun:test";
import { BrainClient } from "./client.js";

describe("BrainClient HTTP adapter", () => {
  test("surfaces unreachable / unhealthy server as null health", async () => {
    const fetchFn = mock(async () => new Response("", { status: 500 }));
    const c = new BrainClient("http://x", fetchFn as unknown as typeof fetch);
    expect(await c.health()).toBeNull();
  });

  test("returns trimmed context text from a successful context response", async () => {
    const fetchFn = mock(async () =>
      new Response(JSON.stringify({ context: "hello world" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const c = new BrainClient("http://x", fetchFn as unknown as typeof fetch);
    const ctx = await c.getContext("q");
    expect(ctx).toBe("hello world");
  });

  test("returns null policy decision when the server errors", async () => {
    const fetchFn = mock(async () => new Response("", { status: 503 }));
    const c = new BrainClient("http://x", fetchFn as unknown as typeof fetch);
    expect(
      await c.evaluatePolicy({
        actor: "a",
        action: "read",
        resource: "/tmp/x",
      })
    ).toBeNull();
  });
});
