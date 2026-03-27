/** Maps OpenCode permission objects to brain policy resource strings (stable contract). */
import { describe, expect, test } from "bun:test";
import type { Permission } from "@opencode-ai/sdk";
import { permissionResourceFromOpenCode } from "./permission-resource.js";

function perm(over: Partial<Permission> & Pick<Permission, "type">): Permission {
  return {
    id: "p1",
    sessionID: "s1",
    messageID: "m1",
    title: "t",
    metadata: {},
    time: { created: 0 },
    ...over,
  };
}

describe("permissionResourceFromOpenCode", () => {
  test("prefers metadata.path", () => {
    expect(
      permissionResourceFromOpenCode(
        perm({ type: "x", metadata: { path: "/foo/bar" } })
      )
    ).toBe("/foo/bar");
  });

  test("falls back to pattern array", () => {
    expect(
      permissionResourceFromOpenCode(
        perm({ type: "glob", pattern: ["a", "b"], metadata: {} })
      )
    ).toBe("a,b");
  });

  test("falls back to type", () => {
    expect(permissionResourceFromOpenCode(perm({ type: "network.mcp", metadata: {} }))).toBe(
      "network.mcp"
    );
  });
});
