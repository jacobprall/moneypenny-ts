-- Moneypenny JS schema
-- Knowledge engine: documents + chunks (replaces sqlite-memory)

-- Documents (replaces knowledge_entries for knowledge store)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source TEXT,
  title TEXT,
  content_hash TEXT,
  context TEXT NOT NULL,
  metadata TEXT,
  status TEXT DEFAULT 'active',
  chunk_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Chunks with embeddings (sqlite-ai for embed, sqlite-vector for KNN)
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  content TEXT NOT NULL,
  position INTEGER NOT NULL,
  content_embedding BLOB,
  embedding_model TEXT,
  embedding_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_unembedded ON chunks(id) WHERE content_embedding IS NULL;

-- FTS5 for keyword search
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  content='chunks',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS chunks_fts_insert AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER IF NOT EXISTS chunks_fts_delete AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;
CREATE TRIGGER IF NOT EXISTS chunks_fts_update AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
END;

-- Legacy: knowledge_entries (deprecated, kept for migration period)
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source TEXT,
  title TEXT,
  content_hash TEXT,
  context TEXT NOT NULL,
  metadata TEXT,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Append-only event log
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  actor TEXT NOT NULL,
  session_id TEXT,
  input TEXT,
  output TEXT,
  error TEXT,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

-- Scheduled jobs
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  schedule TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT,
  next_run_at INTEGER,
  last_run_at INTEGER,
  overlap_policy TEXT DEFAULT 'skip',
  max_retries INTEGER DEFAULT 3,
  timeout_ms INTEGER DEFAULT 30000,
  status TEXT DEFAULT 'active',
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Job execution history
CREATE TABLE IF NOT EXISTS job_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  status TEXT NOT NULL,
  result TEXT,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Policies (sync-enabled)
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  effect TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  action_pattern TEXT,
  resource_pattern TEXT,
  actor_pattern TEXT,
  message TEXT,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Hooks (pre/post, sync-enabled)
CREATE TABLE IF NOT EXISTS hooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phase TEXT NOT NULL,
  match_pattern TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  script TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- User-defined operations (JS in DB)
CREATE TABLE IF NOT EXISTS operation_scripts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  input_schema TEXT,
  script TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Brains (multi-brain scoping)
CREATE TABLE IF NOT EXISTS brains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scope TEXT,
  policies TEXT,
  context_config TEXT,
  sync_enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Sync config (cloud URL, interval)
CREATE TABLE IF NOT EXISTS sync_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_operation ON events(operation);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_source_type ON knowledge_entries(source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_context ON knowledge_entries(context);
CREATE INDEX IF NOT EXISTS idx_jobs_next_run ON jobs(next_run_at) WHERE enabled = 1;
CREATE INDEX IF NOT EXISTS idx_job_runs_job ON job_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_context ON documents(context);

-- Built-in embedder job (runs every 5 min)
INSERT OR IGNORE INTO jobs (id, name, description, schedule, operation, payload, next_run_at, last_run_at, overlap_policy, max_retries, timeout_ms, status, enabled, created_at, updated_at)
VALUES (
  'embedder-chunks',
  'Embed unembedded chunks',
  'Background job: embed chunks from documents via sqlite-ai',
  '*/5 * * * *',
  'embedder.run',
  NULL,
  (strftime('%s','now') * 1000),
  NULL,
  'skip',
  3,
  60000,
  'active',
  1,
  (strftime('%s','now') * 1000),
  (strftime('%s','now') * 1000)
);
