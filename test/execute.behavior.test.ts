/**
 * Operation dispatch: registry + persistence behave as public API consumers expect.
 */

import { describe, expect, test } from "bun:test";
import { execute } from "../src/core/operations";
import { withIsolatedBrainDb } from "./support/harness";

describe("execute", () => {
  test("rejects unknown operation names", async () => {
    await withIsolatedBrainDb(false, async (db) => {
      await expect(
        execute("definitely.unknown.op_12345", {}, { db, actor: "t" })
      ).rejects.toThrow(/Unknown operation/);
    });
  });

  test("persists policies and lists them", async () => {
    await withIsolatedBrainDb(false, async (db) => {
      await execute(
        "policy.add",
        {
          name: "team-readonly",
          effect: "allow",
          priority: 0,
          actionPattern: "knowledge\\..*",
        },
        { db, actor: "test-runner" }
      );

      const listed = await execute("policy.list", {}, { db, actor: "test-runner" });
      expect(listed.policies.length).toBe(1);
      expect(listed.policies[0].name).toBe("team-readonly");
      expect(listed.policies[0].effect).toBe("allow");
    });
  });

  test("records audit events via activity.append", async () => {
    await withIsolatedBrainDb(false, async (db) => {
      const { id } = await execute(
        "activity.append",
        {
          operation: "e2e.check",
          actor: "test-runner",
          sessionId: "sess-1",
          input: { step: 1 },
        },
        { db, actor: "http" }
      );
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      const { events } = await execute(
        "activity.query",
        { operation: "e2e.check", limit: 10 },
        { db, actor: "test-runner" }
      );
      expect(events.some((e) => e.id === id)).toBe(true);
    });
  });
});
