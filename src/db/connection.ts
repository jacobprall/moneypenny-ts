/**
 * SQLite connection with extension loading.
 * Order: vector → cloudsync (sqlite-sync) → ai (sqlite-ai for embeddings).
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { getExtensionPath as getSyncPath } from "@sqliteai/sqlite-sync";
import { getExtensionPath as getAiPath } from "@sqliteai/sqlite-ai";

const PROJECT_ROOT = join(import.meta.dir, "../..");
const VENDOR_DIR = join(PROJECT_ROOT, "vendor");
const MODELS_DIR = join(VENDOR_DIR, "models");

const EXT = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";
const VECTOR_PATH = join(VENDOR_DIR, `vector.${EXT}`);

/** Homebrew sqlite paths for macOS (Apple SQLite doesn't support extensions) */
const MACOS_SQLITE_PATHS = [
  "/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib",
  "/opt/homebrew/Cellar/sqlite/lib/libsqlite3.dylib",
  "/usr/local/opt/sqlite/lib/libsqlite3.dylib",
];

function ensureExtensionsLoadable(): void {
  if (process.platform === "darwin") {
    const customPath = MACOS_SQLITE_PATHS.find((p) => existsSync(p));
    if (customPath) {
      Database.setCustomSQLite(customPath);
    } else {
      console.warn(
        "macOS: Apple SQLite doesn't support extensions. Install: brew install sqlite"
      );
    }
  }
}

export interface ConnectionOptions {
  path?: string;
  modelPath?: string;
}

/**
 * Open database, load extensions, run migrations.
 * Call this before any other db operations.
 * Embedding model is initialized lazily by the embedding module.
 */
export async function connect(options: ConnectionOptions = {}): Promise<Database> {
  ensureExtensionsLoadable();

  const dbPath = options.path ?? join(PROJECT_ROOT, "data", "brain.db");
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }
  const db = new Database(dbPath, { create: true });

  // Load extensions (vector → cloudsync → ai)
  if (existsSync(VECTOR_PATH)) {
    db.loadExtension(VECTOR_PATH);
  } else {
    throw new Error(`sqlite-vector not found at ${VECTOR_PATH}. Run: bun run setup`);
  }
  try {
    db.loadExtension(getSyncPath());
  } catch (e) {
    console.warn("sqlite-sync not loaded:", e instanceof Error ? e.message : e);
  }
  try {
    db.loadExtension(getAiPath());
  } catch (e) {
    console.warn("sqlite-ai not loaded:", e instanceof Error ? e.message : e);
  }

  await migrate(db);
  const { initSyncTables } = await import("./sync");
  initSyncTables(db);

  // Initialize vector search for chunks (sqliteai/sqlite-vector)
  try {
    db.run(
      "SELECT vector_init('chunks', 'content_embedding', 'type=FLOAT32,dimension=768,distance=cosine')"
    );
  } catch (e) {
    console.warn("vector_init for chunks failed:", e instanceof Error ? e.message : e);
  }

  return db;
}

export function getModelsDir(): string {
  return MODELS_DIR;
}

async function migrate(db: Database): Promise<void> {
  const schemaPath = join(import.meta.dir, "schema.sql");
  const sql = await Bun.file(schemaPath).text();
  db.exec(sql);
}
