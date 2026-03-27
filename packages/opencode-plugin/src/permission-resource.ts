import type { Permission } from "@opencode-ai/sdk";

/**
 * Derive a policy resource string aligned with OpenCode's `Permission` shape
 * (metadata paths, patterns, then permission type).
 */
export function permissionResourceFromOpenCode(perm: Permission): string {
  const meta = perm.metadata ?? {};
  if (typeof meta.path === "string" && meta.path) return meta.path;
  if (typeof meta.file === "string" && meta.file) return meta.file;
  if (typeof meta.command === "string" && meta.command) return meta.command;
  if (typeof meta.cwd === "string" && meta.cwd) return meta.cwd;
  if (Array.isArray(perm.pattern)) return perm.pattern.join(",");
  if (typeof perm.pattern === "string") return perm.pattern;
  return perm.type;
}
