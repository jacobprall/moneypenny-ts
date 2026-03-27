import type { MiddlewareHandler } from "hono";
import type { Database } from "bun:sqlite";
import type { ZodError } from "zod";
import { getDb } from "../state";

export type BrainHttpVars = {
  db: Database;
};

/**
 * Require an initialized brain DB for /api/* routes.
 */
export const requireDbMiddleware: MiddlewareHandler<{
  Variables: BrainHttpVars;
}> = async (c, next) => {
  const db = getDb();
  if (!db) {
    return c.json({ error: "Database not ready" }, 503);
  }
  c.set("db", db);
  await next();
};

export function isPolicyDenied(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith("Policy denied");
}

export function zodErrorMessage(err: ZodError): string {
  const issues = err.issues;
  if (!issues.length) return "Invalid request body";
  return issues
    .map((i) => {
      const path = Array.isArray(i.path)
        ? i.path.map((p) => (typeof p === "symbol" ? String(p) : String(p))).join(".")
        : "";
      return `${path || "body"}: ${i.message}`;
    })
    .join("; ");
}
