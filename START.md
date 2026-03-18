# Moneypenny JS — Implementation Plan (3.16.26)

## Original Brainstorm

What I know:

1. Functionality exposed via MCP and pre-post hooks. That's our focus for this session.
  (We will ALSO want a standalone agent runtime, but will not build now, but should build with that in mind.)
2. Will need UI at some point
3. Primary surface areas:
  1. Knowledge - ingested, processed, and stored web pages and documents. first class retrieval. chunked and optimized. User either provides url, local file, or processed by job. top-level graph linked by topic
    1. /learn
  2. Focus - context engineering platform.
  3. Behaviors - Cron jobs, data processing and web jobs that can be created and scheduled in natural language by user.
  4. Memory - write only append log of all actions.
  5. Facts - information provided by user for storage, compaction, optimization, automated injection. graph linked.

We should design with a local-first philosophy, and tasks/jobs/processing should be able to pick up and execute when app starts up AFTER syncing with cloud (sqlite-sync).

Core primitives and requirements:

1. Web fetch
2. Data processing (html -> markdown -> chunks -> embeddings)
3. Task queue
4. Sync (sqlite-sync)
5. Retrieval (sqlite-memory for first search strategy, but we will want others)
6. MCP interface

Tech choices:
1. SQLite + sqlite-memory (default knowledge strategy) + nomic embedding local model + sqlite-sync for multi-device
2. Hono.js as server, Bun.js as runtime, TypeScript

---

## First Principles

### What is Moneypenny, irreducibly?

Four things:

1. **A persistent store** (SQLite) that holds structured and unstructured knowledge
2. **A set of operations** that read from and write to that store
3. **A protocol interface** (MCP) that exposes those operations to agents
4. **Background processing** that keeps the store fresh and useful

Everything else — knowledge, facts, focus, experience, jobs — composes from these four.

### Key constraints

- **SQLite is the center of gravity.** Every feature reads/writes SQLite. The application layer is thin orchestration.
- **sqlite-memory is a C extension loaded into the SQLite connection.** Chunking, embedding, and hybrid search happen in SQL. Our JS code doesn't reimplement these — it calls SQL functions that do.
- **MCP defines the interface shape.** Tool calls with `{action, input}` → result. The Command pattern isn't a choice — the protocol requires it.
- **Bun gives us `bun:sqlite` natively.** Direct C extension loading, no extra bindings.
- **Single-user, single-process.** A sidecar, not a multi-tenant server. No worker pools, connection pools, or distributed locks needed. One Bun process + SQLite WAL mode is sufficient.

---

## Architecture Decisions

### 1. Operations (the spine)

Every meaningful thing the system does is an **Operation** — a typed, validated, serializable unit of work.

```typescript
interface Operation<TInput = unknown, TOutput = unknown> {
  name: string;        // qualified: "facts.add", "knowledge.ingest"
  input: TInput;
  execute(ctx: OperationContext): Promise<TOutput>;
}
```

**No separate `domain` field.** The name is a qualified string. Module grouping is a source-code concern, not a runtime concept. Adding a `domain` field creates drift risk and couples operations to organizational structure. The operation is agnostic.

**Internal vs agent-cycle:** Operations don't know or care who calls them. The MCP transport layer maintains an explicit routing table of which operations it exposes as tools. The scheduler calls the same operations that agents do. No metadata on the operation itself — the caller context (passed via `OperationContext`) carries any needed distinction.

Why this matters:
- MCP tool calls map 1:1 to operations
- Operations are serializable — you can log them, queue them, replay them
- Events emit naturally — after any operation, append to the event log
- Jobs are just deferred operations — a scheduled job is an operation with a cron trigger
- Everything flows through one execution path: validate → execute → log

### 2. Knowledge (unified store)

**Facts and knowledge are consolidated.** A "fact" is a knowledge entry with `source: "user"`. One storage path, one retrieval system. Metadata distinguishes origin, not separate subsystems.

A user saying "remember that we use Redis for caching" creates a knowledge entry of type `fact`. Ingesting a URL creates knowledge entries of type `document`. The retrieval interface doesn't care — it searches across everything.

**Documents and chunks are delegated entirely to sqlite-memory.** We don't maintain our own `documents` or `chunks` tables. sqlite-memory has internal tables (`dbmem_content`, etc.) and SQL functions (`memory_add_text`, `memory_search`). We call those.

What we DO own:
- A **knowledge metadata table** — tracks what was ingested, when, from where, source type, status. This is our index of what's in sqlite-memory, for management/listing/deletion purposes.
- A **parsing processor** — takes HTTP response data, extracts web content (strips nav, ads, boilerplate), converts to clean markdown, and hands the result to the KnowledgeStore interface.

### 3. Pipeline (swappable via interface contract)

sqlite-memory is the first implementation, but nothing above it depends on sqlite-memory directly. We define a **KnowledgeStore** interface:

```typescript
interface KnowledgeStore {
  add(content: string, context: string, metadata?: Record<string, unknown>): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  delete(context: string): Promise<void>;
  configure?(options: Record<string, unknown>): void;
}

interface SearchResult {
  content: string;
  context: string;
  score: number;
  metadata?: Record<string, unknown>;
}
```

The first implementation (`SqliteMemoryStore`) wraps the sqlite-memory SQL functions. If we later want pgvector, Qdrant, or a different strategy, we implement the same interface.

The intake pipeline sits BEFORE the KnowledgeStore:

```
Source → Fetch → Parse/Extract → Normalize to Markdown → KnowledgeStore.add()
```

Stages:
- **Source**: URL, file path, or inline text
- **Fetch**: HTTP fetch, file read, or passthrough
- **Parse/Extract**: HTML → extract main content (strip chrome, nav, ads) → markdown. This is our processor.
- **KnowledgeStore**: Handles chunking, embedding, indexing, search

The Strategy pattern applies at Fetch and Parse — different source types need different handling. But the pipeline is short and the seams are clear.

### 4. Task Queue (SQLite-backed, application-level)

**No SQLite extension needed.** The `jobs` table IS the queue. SQLite + WAL mode + Bun's event loop is sufficient for a single-user sidecar.

Design:
- **Scheduler** — runs on a `setInterval`, checks `jobs.next_run_at <= now`, picks eligible jobs
- **Job Runner** — enforces overlap policy (skip/queue/allow), timeout, retry with backoff
- **Execution** — dispatches through the same operation system. A job is an operation invoked by the scheduler instead of by an agent. Same code path.

For the global task queue across devices: sqlite-sync IS the distribution mechanism. A cloud node writes a `status: "pending"` job row, sync replicates it, local node's scheduler picks it up. The queue is the table. Sync is the transport.

### 5. Event Log (memory / audit trail)

Append-only. Every operation emits an event after execution. This gives us:
- Activity queries (what happened, when, who)
- Hook triggers (post-hooks can fire on events)
- Audit trail for free
- Future event-sourcing capability

```typescript
interface Event {
  id: string;
  operation: string;    // "knowledge.ingest", "facts.add"
  actor: string;        // "mcp:cursor", "scheduler", "hook:post"
  input: unknown;
  output: unknown;
  timestamp: number;
}
```

### 6. MVP Scope — What We Drop

- **No policy engine.** Add later when we need guardrails.
- **No fact_audit table.** Events cover this.
- **No experience engine.** Phase 2, after we have enough event history to learn from.
- **No context composition engine (Focus).** Postponed until we build the full agent loop.
- **No web UI.** Postponed.
- **No pre/post hooks.** Phase 2. The event log lays groundwork for them.

---

## Repository Layer

Thin typed query functions. Not an ORM. Encapsulates SQL, provides types, manages transactions.

```typescript
const knowledge = {
  track(db: Database, entry: NewKnowledgeEntry): KnowledgeEntry { ... },
  list(db: Database, options?: ListOptions): KnowledgeEntry[] { ... },
  findBySource(db: Database, source: string): KnowledgeEntry | null { ... },
  remove(db: Database, id: string): void { ... },
};

const events = {
  append(db: Database, event: NewEvent): void { ... },
  query(db: Database, filters: EventFilters): Event[] { ... },
};

const jobs = {
  create(db: Database, job: NewJob): Job { ... },
  findDue(db: Database, now: number): Job[] { ... },
  recordRun(db: Database, run: JobRun): void { ... },
  updateNextRun(db: Database, jobId: string, nextRunAt: number): void { ... },
};
```

---

## Module Structure

```
src/
  index.ts                  ← entry: load DB, start MCP server, start scheduler
  
  db/
    connection.ts           ← SQLite connection + extension loading (sqlite-memory, sqlite-vector)
    migrate.ts              ← schema migrations
    schema.sql              ← DDL for our tables (knowledge_entries, events, jobs, job_runs)
  
  core/
    operations.ts           ← Operation interface, registry, execute wrapper (validate → run → log)
    events.ts               ← Append-only event log (repository + helpers)
    context.ts              ← OperationContext type (actor, session, db handle)
  
  modules/
    knowledge/
      operations.ts         ← knowledge.add, knowledge.search, knowledge.ingest, knowledge.list, knowledge.delete
      repository.ts         ← knowledge metadata table queries
    facts/
      operations.ts         ← facts.add, facts.search (thin wrappers — facts are knowledge with source:"user")
    jobs/
      operations.ts         ← jobs.create, jobs.list, jobs.pause, jobs.resume
      repository.ts         ← jobs + job_runs table queries
      scheduler.ts          ← cron evaluator, setInterval loop, job runner
  
  pipeline/
    store.ts                ← KnowledgeStore interface
    sqlite-memory.ts        ← KnowledgeStore implementation backed by sqlite-memory SQL functions
    sources.ts              ← ContentSource interface + URL/file/text implementations
    parsers.ts              ← HTML content extraction + markdown conversion
  
  transport/
    mcp.ts                  ← MCP server (stdio transport), tool definitions, routing table
    http.ts                 ← Hono server (for future HTTP transport + UI)
```

Dependency flow: `transport → modules → core → db`. Pipeline is a peer of modules, used by knowledge operations.

---

## Minimal Schema (our tables — sqlite-memory manages its own)

```sql
-- What we've ingested and where it came from
CREATE TABLE knowledge_entries (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,        -- 'user' (fact), 'url', 'file', 'text'
  source TEXT,                       -- URL, file path, or null for inline
  title TEXT,
  content_hash TEXT,                 -- for dedup / change detection
  context TEXT NOT NULL,             -- sqlite-memory context key
  metadata TEXT,                     -- JSON blob
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Append-only event log
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  actor TEXT NOT NULL,
  session_id TEXT,
  input TEXT,                        -- JSON
  output TEXT,                       -- JSON
  error TEXT,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

-- Scheduled jobs
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  schedule TEXT NOT NULL,            -- cron expression
  operation TEXT NOT NULL,           -- operation name to dispatch
  payload TEXT,                      -- JSON input for the operation
  next_run_at INTEGER,
  last_run_at INTEGER,
  overlap_policy TEXT DEFAULT 'skip',  -- skip | queue | allow
  max_retries INTEGER DEFAULT 3,
  timeout_ms INTEGER DEFAULT 30000,
  status TEXT DEFAULT 'active',
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Job execution history
CREATE TABLE job_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  status TEXT NOT NULL,              -- running | completed | failed | timeout
  result TEXT,                       -- JSON
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_events_operation ON events(operation);
CREATE INDEX idx_events_created ON events(created_at);
CREATE INDEX idx_knowledge_source_type ON knowledge_entries(source_type);
CREATE INDEX idx_knowledge_context ON knowledge_entries(context);
CREATE INDEX idx_jobs_next_run ON jobs(next_run_at) WHERE enabled = 1;
CREATE INDEX idx_job_runs_job ON job_runs(job_id);
```

---

## Build Order

Each step produces a working, testable increment.

### Step 1: Database Foundation
- SQLite connection with `bun:sqlite`
- Extension loading (sqlite-memory, sqlite-vector)
- Schema migrations
- Verify sqlite-memory functions work (`memory_set_model`, `memory_add_text`, `memory_search`)

### Step 2: Core Framework
- Operation interface and registry
- OperationContext type
- Execute wrapper: validate input → run operation → append event
- Event log (repository + append function)

### Step 3: KnowledgeStore Interface + sqlite-memory Implementation
- Define `KnowledgeStore` interface in `pipeline/store.ts`
- Implement `SqliteMemoryStore` wrapping sqlite-memory SQL functions
- Configuration: model path, search options
- Verify: add text, search, delete via the interface

### Step 4: Knowledge Module
- `knowledge.add` — inline text → KnowledgeStore, track in knowledge_entries
- `knowledge.search` — query through KnowledgeStore interface
- `knowledge.list` — list from knowledge_entries table
- `knowledge.delete` — remove from KnowledgeStore + knowledge_entries

### Step 5: Facts (thin layer over Knowledge)
- `facts.add` — creates a knowledge entry with `source_type: "user"`, optional keywords/confidence in metadata
- `facts.search` — delegates to knowledge.search, optionally filtered to source_type: "user"
- Facts ARE knowledge. This module is just ergonomic sugar for the MCP tool surface.

### Step 6: Content Pipeline
- `ContentSource` interface + implementations (URL fetcher, file reader, text passthrough)
- HTML parser/extractor — takes raw HTTP response, strips boilerplate, extracts main content
- Markdown normalizer — ensures clean markdown output
- `knowledge.ingest` operation — Source → Fetch → Parse → Normalize → KnowledgeStore.add()

### Step 7: MCP Transport
- MCP server on stdio transport
- Tool definitions: `moneypenny_knowledge`, `moneypenny_facts`
- Routing table: tool action → operation dispatch
- Wire up: agent calls tool → parse action/input → dispatch operation → return result

**At this point: working MCP sidecar with knowledge ingestion, facts, and search.**

### Step 8: Jobs + Scheduler
- Jobs repository (CRUD on jobs table)
- Job runs repository
- `jobs.create`, `jobs.list`, `jobs.pause`, `jobs.resume` operations
- Scheduler loop: `setInterval` → find due jobs → dispatch as operations → record runs
- Cron expression parsing (use a small library or write minimal parser)
- Overlap policy enforcement, retry logic, timeout
- MCP tool: `moneypenny_jobs`

### Step 9: HTTP Transport (groundwork)
- Hono server alongside MCP stdio
- Health check endpoint
- Prepare for future: SSE/streamable-HTTP MCP transport, web UI serving

---

## Open Questions (Parking Lot)

- **Graph linking**: Knowledge entries linked by topic. What's the right structure? Edges table? Tags? Defer until we have enough content to link.
- **Compaction**: Facts accumulate. When/how do we compact? Needs LLM in the loop. Defer to agent runtime phase.
- **sqlite-sync integration**: When to introduce multi-device sync? After core is stable.
- **Agent runtime**: Standalone agent loop (not sidecar). Build with it in mind, implement later.
- **Context engineering (Focus)**: Token-budget-aware context assembly. Depends on agent runtime.
- **Pre/post hooks**: Event log lays groundwork. Implement when we have the agent loop.
- **Experience engine**: Learn from failures. Needs event history + pattern matching. Phase 2.
- **Web UI**: Dashboard, knowledge browser, job manager. Hono serves it. Postpone.
