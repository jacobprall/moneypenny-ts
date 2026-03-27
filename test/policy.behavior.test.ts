/**
 * Policy engine: observable decisions from actor + action + resource inputs.
 * Uses in-memory schema — no extensions or vendor setup.
 */

import { describe, expect, test } from "bun:test";
import { execute } from "../src/core/operations";
import { withIsolatedBrainDb } from "./support/harness";

describe("policy.evaluate", () => {
  test("allows when nothing matches and default is allow", async () => {
    await withIsolatedBrainDb(false, async (db) => {
      const out = await execute(
        "policy.evaluate",
        { actor: "alice", action: "knowledge.search", resource: "docs" },
        { db, actor: "test-runner" }
      );
      expect(out.effect).toBe("allow");
      expect(out.matchedPolicy).toBeNull();
    });
  });

  test("denies when nothing matches and deny-by-default is on", async () => {
    await withIsolatedBrainDb(false, async (db) => {
      const out = await execute(
        "policy.evaluate",
        {
          actor: "alice",
          action: "knowledge.search",
          resource: "docs",
          denyByDefault: true,
        },
        { db, actor: "test-runner" }
      );
      expect(out.effect).toBe("deny");
      expect(out.matchedPolicy).toBeNull();
    });
  });

  test("first matching row by priority wins", async () => {
    await withIsolatedBrainDb(false, async (db) => {
      await execute(
        "policy.add",
        {
          name: "low",
          effect: "audit",
          priority: 1,
          actionPattern: "tools\\..*",
          resourcePattern: ".*",
          actorPattern: ".*",
        },
        { db, actor: "test-runner" }
      );
      await execute(
        "policy.add",
        {
          name: "high",
          effect: "deny",
          priority: 100,
          actionPattern: "tools\\..*",
          resourcePattern: ".*",
          actorPattern: ".*",
        },
        { db, actor: "test-runner" }
      );

      const out = await execute(
        "policy.evaluate",
        { actor: "bob", action: "tools.run", resource: "x" },
        { db, actor: "test-runner" }
      );
      expect(out.effect).toBe("deny");
      expect(out.matchedPolicy?.name).toBe("high");
    });
  });
});
