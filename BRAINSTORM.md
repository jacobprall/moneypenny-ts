# Brains — BRAINSTORM

**Product:** Brains — dev-first open-source operating system for MCP deployment and context orchestration.

**Target:** Director of platform engineering provisioning coding agents to users. Unified tool suite, tightly scoped knowledge, coordination, context management, cost controls.

**Brand:** "brains" — `npx brainstorm init`, `brainstorm serve`, etc.

---

## Key Architectural Decisions

### 1. User-defined operations stored in SQLite

**Decision:** JS/TS code for custom operations lives in the database, not as files on disk.

- Operations table includes a `script` column (or linked `operation_scripts` table)
- User defines an operation: name, description, input schema, JS body
- At runtime, brain loads and executes the script via a sandboxed eval or QuickJS
- Enables: sync of custom tools across fleet, versioning with the brain, no file-system coupling
- Policy engine can govern which operations are exposed to which actors

**Implication:** Use Bun's `new Function()` (trusted-first). Build smart helper modules for DRY, SOLID, SRP. No input validation against schema — script trusts input.

### 2. sqlite-sync is critical

**Decision:** CRDT sync via sqlite-sync (cloudsync) is a core requirement, not a later add-on.

- Shared brain across devices and team members
- Jobs table syncs → distributed task queue
- Facts, knowledge, policies sync → single logical brain
- Use `@sqliteai/sqlite-sync` npm package — prebuilt binaries per platform, auto-downloaded on install
- Cloud sync optional from day one; background sync every 5 mins (configurable in DB)

**Implication:** Add `@sqliteai/sqlite-sync` dependency. Load via `getExtensionPath()` in `db/connection.ts`. Add `cloudsync_init()` for sync-enabled tables. Sync config (URL, interval) stored in DB.

### 3. CLI: brainstorm

**Decision:** The CLI is named `brainstorm`.

- `npx brainstorm init` — create brain config + data dir
- `npx brainstorm setup` — download extensions + model
- `npx brainstorm serve` — start MCP server + HTTP + scheduler
- `npx brainstorm status` — show brain state, policies, jobs
- `npx brainstorm add-fact "..."` — quick fact entry
- `npx brainstorm search "..."` — quick search
- `npx brainstorm sync` — trigger sync
- `npx brainstorm policy list` — show active policies

### 4. Execute pipeline: policy + hooks

**Decision:** Every operation flows through: pre-hooks → policy check → execute → post-hooks → audit.

- Pre-hooks: inject context, validate, rate-limit, abort
- Policy: allow/deny/audit by actor, action, resource
- Post-hooks: transform output, trigger side-effects
- Audit: enriched event log with policy decision metadata

### 5. No DSL

**Decision:** Skip the custom query DSL from the Rust implementation. Use SQL, operation names, and config (TOML/YAML) for declarative setup. Simpler surface, faster to ship.

### 6. Knobs we expose

| Knob | Purpose |
|------|---------|
| Policy engine | Governance — who can do what |
| Pre/post hooks | Extensibility, guardrails |
| User UDFs (JS in DB) | Custom operations as first-class |
| Cron jobs | Scheduled operations |
| Knowledge management | Ingest, search, scope |
| Context engineering | Token budgets, retrieval tuning |
| Sync | Multi-device, team shared brain |

---

## Resolved Design Decisions (pre-implementation)

### Policy engine
- **Default mode:** Boolean in brain.toml: `deny_by_default: true | false`
- **Pattern matching:** Support regex (not just glob) for action_pattern, actor_pattern, resource_pattern
- **Audit effect:** Operation runs AND is logged. Audit = allow + record for compliance.

### Hooks
- **Storage:** Hooks live in DB (sync-enabled) — seamless management across devices via CRDT
- **User-defined:** Users can define and run JS hooks in Phase 1
- **Phases:** Explicit phases: `pre:validation`, `pre:injection`, `post:transform`, etc. (extensible)

### User operations (JS in DB)
- **Execution:** Bun's `new Function()` — trusted-first
- **Helpers:** Build smart helper modules (execute, search, db access) for DRY, SOLID, SRP
- **Validation:** No input validation — script is trusted

### Sync
- **Cloud:** Optional from day one
- **Background:** 5 min interval, configurable in DB
- **Platforms:** All — darwin (arm64, x64), linux (arm64, x64, musl), win32 (x64)

### CLI
- **Entrypoint:** Single `brainstorm` binary/script with subcommands
- **Config:** Configurable via `--config` / env
- **Data dir:** Configurable via `--data-dir` / env

### MCP + Policy
- **Policy enforcement:** Only inside `execute()` — single enforcement point
- **User ops exposure:** Only when explicitly enabled — congruous with policy system
- **Design:** Policy + user ops designed for CRDT sync and local enforcement across devices

### sqlite-sync prebuilt
- **Source:** `@sqliteai/sqlite-sync` npm package (GitHub sqliteai/sqlite-sync)
- **Platforms:** All — darwin-arm64, darwin-x64, linux-arm64, linux-x64, linux-*-musl, win32-x64

---

## Build Priority

### Phase 1: Foundation (MVP)

1. **sqlite-sync integration**
   - Add cloudsync to vendor setup (prebuilt per platform)
   - Load extension in connection.ts
   - Init sync on tables: knowledge_entries, events, jobs, job_runs, policies (when added)
   - Optional: cloud sync URL in config

2. **Policy engine + schema**
   - `policies` table: id, name, effect, priority, action_pattern, resource_pattern, actor_pattern, message, created_at
   - Policy evaluation in `execute()`: before running operation, check policies, allow/deny/audit
   - Policy operations: `policy.add`, `policy.list`, `policy.disable`
   - Default: allow-by-default for dev; configurable deny-by-default for production

3. **Hooks in execute()**
   - Hook registry: pre-hooks and post-hooks with match patterns (operation name glob)
   - Hook interface: `(ctx) => { action: "continue" | "abort" | "mutate", input?, output?, reason? }`
   - Execute pipeline: pre-hooks → policy → op.execute → post-hooks → append event

4. **brainstorm CLI**
   - `brainstorm init` — create `brain.toml`, `data/` dir
   - `brainstorm setup` — run vendor setup (extensions + model)
   - `brainstorm serve` — start sidecar (MCP + HTTP + scheduler)
   - `brainstorm status` — brain info, sync status, job count, policy count

### Phase 2: Extensibility

5. **User operations in SQLite**
   - `operation_scripts` table: id, name, description, input_schema (JSON), script (JS text), created_at
   - Load and register at startup; execute via sandboxed runner
   - MCP exposes them as tools (policy governs visibility)
   - `operations.add` / `operations.list` / `operations.remove`

6. **Multi-brain / scoping**
   - `brains` table: id, name, scope, policies (JSON array), context_config (JSON), sync_enabled
   - Knowledge/facts/jobs scoped by brain_id
   - Config: which brain(s) this instance serves

7. **Context engineering knobs**
   - ContextConfig in brain/config: token_budget, split (system/knowledge/conversation/facts), retrieval (strategy, max_results, min_score, reranking)
   - Used when assembling context for agent (future agent runtime integration)

### Phase 3: Fleet & polish

8. **Sync UX**
   - `brainstorm sync` — manual trigger
   - Config: cloud URL, API key
   - Status shows sync state (site_id, db_version, last sync)

9. **Policy management CLI**
   - `brainstorm policy list`
   - `brainstorm policy add --file policy.toml`
   - `brainstorm policy disable <id>`

10. **Dashboard / HTTP API**
    - Expand Hono routes: /api/events, /api/jobs, /api/policies, /api/knowledge
    - Groundwork for future web UI

---

## Schema Additions (for Phase 1–2)

```sql
-- Policies (sync-enabled)
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  effect TEXT NOT NULL,           -- allow | deny | audit
  priority INTEGER DEFAULT 0,
  action_pattern TEXT,            -- glob: knowledge.*, jobs.create
  resource_pattern TEXT,
  actor_pattern TEXT,
  message TEXT,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- User-defined operations (JS in DB)
CREATE TABLE IF NOT EXISTS operation_scripts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  input_schema TEXT,              -- JSON schema
  script TEXT NOT NULL,           -- JS body
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Brains (multi-brain scoping)
CREATE TABLE IF NOT EXISTS brains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scope TEXT,
  policies TEXT,                  -- JSON array of policy IDs
  context_config TEXT,            -- JSON
  sync_enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Hooks (pre/post, sync-enabled)
CREATE TABLE IF NOT EXISTS hooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phase TEXT NOT NULL,            -- pre:validation, pre:injection, post:transform, etc.
  match_pattern TEXT NOT NULL,    -- regex for operation name
  priority INTEGER DEFAULT 0,
  script TEXT NOT NULL,           -- JS body
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Sync config (cloud URL, interval)
CREATE TABLE IF NOT EXISTS sync_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

---

## Tech Stack (confirmed)

- **Runtime:** Bun
- **DB:** SQLite + sqlite-vector + sqlite-memory + sqlite-sync (cloudsync)
- **Embeddings:** nomic-embed-text (local GGUF)
- **Server:** Hono
- **MCP:** @modelcontextprotocol/sdk (stdio)
- **Cron:** cron-parser
- **Config:** TOML (brain.toml)

---

## Sync-enabled tables

`cloudsync_init()` applied to: knowledge_entries, events, jobs, job_runs, policies, hooks, operation_scripts, brains, sync_config.
