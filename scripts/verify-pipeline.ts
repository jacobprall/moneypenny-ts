#!/usr/bin/env bun
/**
 * Verifies ingest pipeline and retrieval.
 * Run: bun run scripts/verify-pipeline.ts
 */

import { connect } from "../src/db";
import { runIngestPipeline, runEmbedderBatch } from "../src/pipeline";
import { retrieve } from "../src/retrieval/engine";

async function main() {
  console.log("Verifying ingest pipeline and retrieval...\n");

  const db = await connect();

  const result = await runIngestPipeline(db, {
    source: "text",
    content:
      "SQLite is a C-language library that implements a small, fast, self-contained database engine.",
    context: "verify-pipeline",
  });
  console.log(`✓ ingest: document ${result.documentId}, ${result.chunkCount} chunk(s)`);

  const embedded = await runEmbedderBatch(db);
  console.log(`✓ embedder: ${embedded} chunk(s) embedded`);

  const searchResults = await retrieve(db, "how do databases store information", { limit: 5 });
  console.log(`✓ retrieve: ${searchResults.length} result(s)`);
  if (searchResults.length > 0) {
    console.log(`  Top: ${searchResults[0].content.slice(0, 50)}... (score ${searchResults[0].score})`);
  }

  db.run("DELETE FROM chunks WHERE document_id = ?", [result.documentId]);
  db.run("DELETE FROM documents WHERE id = ?", [result.documentId]);
  console.log("✓ cleanup");

  db.close();
  console.log("\nDone. Pipeline OK.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
