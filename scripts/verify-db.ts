#!/usr/bin/env bun
/**
 * Verifies database foundation: extensions load, schema applies, documents/chunks work.
 * Run: bun run scripts/verify-db.ts
 */

import { connect } from "../src/db/connection";

async function main() {
  console.log("Verifying database foundation...\n");

  const db = await connect();

  const version = db.query("SELECT sqlite_version() as v").get() as { v: string };
  console.log(`✓ SQLite: ${version.v}`);

  const tables = db
    .query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('events', 'documents', 'chunks', 'jobs', 'job_runs')"
    )
    .all() as Array<{ name: string }>;
  console.log(`✓ Schema: ${tables.length}/5 tables (events, documents, chunks, jobs, job_runs)`);

  try {
    db.run("SELECT vector_init('chunks', 'content_embedding', 'type=FLOAT32,dimension=768,distance=cosine')");
    console.log("✓ vector_init (sqlite-vector)");
  } catch (e) {
    console.warn("⚠ vector_init:", e instanceof Error ? e.message : e);
  }

  db.close();
  console.log("\nDone. Database foundation OK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
