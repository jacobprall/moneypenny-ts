/**
 * Session helpers: LRU eviction, timer lifecycle, and health caching — public behaviors only.
 */
import { describe, expect, mock, test } from "bun:test";
import { BrainClient } from "./client.js";
import { CachedBrainHealth, CallTimerMap, PromptLru } from "./brain-session.js";

describe("PromptLru", () => {
  test("evicts oldest when over capacity", () => {
    const lru = new PromptLru(2);
    lru.set("a", "1");
    lru.set("b", "2");
    lru.set("c", "3");
    expect(lru.get("a")).toBeUndefined();
    expect(lru.get("b")).toBe("2");
    expect(lru.get("c")).toBe("3");
  });

  test("set refreshes order", () => {
    const lru = new PromptLru(2);
    lru.set("a", "1");
    lru.set("b", "2");
    lru.set("a", "10");
    lru.set("c", "3");
    expect(lru.get("a")).toBe("10");
    expect(lru.get("b")).toBeUndefined();
  });
});

describe("CallTimerMap", () => {
  test("takeMs returns duration and clears", () => {
    const m = new CallTimerMap(60_000);
    m.start("c1");
    const ms = m.takeMs("c1");
    expect(ms).toBeDefined();
    expect(ms!).toBeGreaterThanOrEqual(0);
    expect(m.takeMs("c1")).toBeUndefined();
  });
});

describe("CachedBrainHealth", () => {
  test("caches success until TTL", async () => {
    let calls = 0;
    const fetchFn = mock(async () => {
      calls++;
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    });
    const client = new BrainClient("http://brain.test", fetchFn as unknown as typeof fetch);
    const health = new CachedBrainHealth(() => client, () => 60_000);
    expect(await health.ok()).toBe(true);
    expect(await health.ok()).toBe(true);
    expect(calls).toBe(1);
    health.reset();
    expect(await health.ok()).toBe(true);
    expect(calls).toBe(2);
  });
});
