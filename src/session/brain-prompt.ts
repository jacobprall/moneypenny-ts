/**
 * Brain context for system prompt — facts + knowledge from retrieval engine.
 */

import type { Database } from "bun:sqlite";
import { retrieve } from "../retrieval/engine";

const DEFAULT_LIMIT = 5;
const MAX_CONTEXT_CHARS = 2000;

export async function context(
  db: Database,
  _sessionId: string,
  userMessage: string
): Promise<string> {
  const results = await retrieve(db, userMessage, { limit: DEFAULT_LIMIT });
  if (results.length === 0) return "";

  const lines: string[] = ["<brain>", "Relevant context from the brain:"];
  let total = 0;
  for (const r of results) {
    const snippet = r.content.slice(0, 400).replace(/\n/g, " ");
    lines.push(`- ${snippet}${r.content.length > 400 ? "..." : ""}`);
    total += snippet.length + 4;
    if (total >= MAX_CONTEXT_CHARS) break;
  }
  lines.push("</brain>");
  return lines.join("\n");
}
