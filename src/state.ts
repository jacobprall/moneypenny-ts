/**
 * Shared process state — db is set when connect() resolves.
 */

import type { Database } from "bun:sqlite";

let db: Database | null = null;

export function getDb(): Database | null {
  return db;
}

export function setDb(d: Database): void {
  db = d;
}
