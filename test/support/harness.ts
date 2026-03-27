/**
 * Test harness: real schema + registered operations + process db wiring.
 * Restores prior `getDb()` after each run so tests stay independent.
 */

import type { Database } from "bun:sqlite";
import { setDefaultDenyByDefault } from "../../src/core/operations";
import { getDb, setDb } from "../../src/state";
import { ensureOperationsRegistered } from "../setup";
import { openMemorySchemaDb } from "./memory-db";

export async function withIsolatedBrainDb<T>(
  denyByDefault: boolean,
  run: (db: Database) => Promise<T>
): Promise<T> {
  ensureOperationsRegistered();
  const previous = getDb();
  const db = await openMemorySchemaDb();
  setDefaultDenyByDefault(denyByDefault);
  setDb(db);
  try {
    return await run(db);
  } finally {
    db.close();
    setDb(previous);
  }
}
