/**
 * In-memory SQLite with the same schema as production — no vendor extensions.
 * Use for fast tests of business behavior (policy, execute, HTTP handlers).
 */

import { Database } from "bun:sqlite";
import { join } from "path";

export async function openMemorySchemaDb(): Promise<Database> {
  const schemaPath = join(import.meta.dir, "../../src/db/schema.sql");
  const sql = await Bun.file(schemaPath).text();
  const db = new Database(":memory:", { create: true });
  db.exec(sql);
  return db;
}
