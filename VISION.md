# Moneypenny Vision

Moneypenny is a personal intelligence assistant — a local-first system with one database and one brain that continuously learns what matters to you, gathers high-signal knowledge, and turns that intelligence into context, actions, and timely insights.

It ships first as a sidecar for coding agents (Cursor, Cortex Code CLI, any MCP-compatible tool), but the architecture is general-purpose. The same brain that makes your coding agent smarter can power briefings, track priorities, and run background jobs across any domain.

## Core Product Promise

Moneypenny should feel like a high-performing personal analyst and chief of staff that compounds over time.

It should:

- Learn and remember what matters to you — across sessions, projects, and devices.
- Surface the right context at the right time — facts, knowledge, prior failures, preferences.
- Ingest any URL, document, or codebase on demand, making it instantly searchable.
- Run background jobs you define in natural language, asynchronously and reliably.
- Hook into agent actions pre- and post-execution, enriching inputs and learning from outputs.
- Convert intent into action with safe, user-controlled autonomy.

## Who It Is For

Anyone who works with AI agents and wants a private, compounding intelligence layer underneath them.

The initial delivery is a coding agent sidecar — Cursor, Cortex Code CLI, or any MCP-compatible editor. But the same engine works for tracking priorities, staying informed, preparing for meetings, or managing any knowledge-heavy workflow. The capabilities are shared; personalization comes from what you teach it.

## Architecture: 1 DB, 1 Brain

Everything lives in a single SQLite database per user. No external services required. One brain, portable across devices, inspectable at any time.

```
┌─────────────────────────────────────────────────────────────────┐
│              Agent (Cursor / Cortex / CLI / any MCP client)      │
│                              ↕ MCP                              │
├─────────────────────────────────────────────────────────────────┤
│                          Moneypenny                             │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Context  │  │  Knowledge │  │ Scheduler│  │  Hooks       │  │
│  │ Engine   │  │  Ingestion │  │ (Jobs)   │  │  (Pre/Post)  │  │
│  └──────────┘  └────────────┘  └──────────┘  └──────────────┘  │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Facts    │  │ Experience │  │ Policy   │  │  UI Layer    │  │
│  │ Store    │  │ Engine     │  │ Engine   │  │  (served)    │  │
│  └──────────┘  └────────────┘  └──────────┘  └──────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  sqlite-memory (embeddings + hybrid search)                     │
│  sqlite-ai (local embedding models)                             │
│  sqlite-sync (CRDT offline-first multi-device sync)             │
├─────────────────────────────────────────────────────────────────┤
│                          SQLite                                 │
└─────────────────────────────────────────────────────────────────┘
```

The tech stack:

- **Bun.js + TypeScript** — fast, batteries-included runtime.
- **sqlite-memory** — markdown-aware chunking, hybrid search (vector + FTS5), local embeddings via llama.cpp.
- **sqlite-ai** — on-device embedding generation, no API keys or data leaving your machine.
- **sqlite-sync** — CRDT-based offline-first sync so the same brain works across your laptop, desktop, and CI.

## The Context Engineering Engine

The core differentiator. Every time an agent calls Moneypenny, the context engine assembles a token-budget-aware payload from multiple sources:

1. **System prompt + persona** — who the agent is.
2. **Active policies** — guardrails and deny rules.
3. **Session summary** — rolling summary of the current conversation.
4. **Fact pointers** — compressed references to all durable knowledge, progressively compacted.
5. **Expanded facts** — full-text retrieval of facts relevant to the current query.
6. **Scratch pad** — session-scoped working memory (plans, notes, intermediate state).
7. **Conversation log** — recent messages for continuity.
8. **Knowledge** — semantically retrieved chunks from ingested documents.
9. **Experience priors** — relevant failure patterns, fixes, and learned outcomes.

The engine dynamically rebalances token allocation based on session state: new sessions get more knowledge budget, deep sessions get more log budget, empty segments redistribute to those that need it.

Composition is logged for auditability — you can always see what context the agent was given and why.

## MCP-First: Sidecar Delivery

Moneypenny exposes everything via MCP (Model Context Protocol). It runs as a sidecar process that agents talk to over stdio or HTTP. The sidecar model means it plugs into any MCP-compatible host — coding agents today, other workflows tomorrow.

**Domain tools exposed:**

| Tool | Purpose |
|------|---------|
| `moneypenny_brain` | Brain lifecycle — create, checkpoint, restore, export |
| `moneypenny_facts` | Durable facts — add, search, update, delete |
| `moneypenny_knowledge` | Ingest and search documents, URLs, codebases |
| `moneypenny_policy` | Governance rules — add, list, disable, evaluate |
| `moneypenny_experience` | Learned priors — record failures, match patterns, resolve |
| `moneypenny_events` | Unified event log — append, query, compact |
| `moneypenny_focus` | Working set + context composition |
| `moneypenny_jobs` | Scheduled background tasks |
| `moneypenny_activity` | Session history and audit trail |
| `moneypenny_execute` | Direct operation escape hatch |

**Easy installation across environments:**

```bash
# Cursor — add to .cursor/mcp.json
{
  "mcpServers": {
    "moneypenny": {
      "command": "bunx",
      "args": ["moneypenny", "sidecar"]
    }
  }
}

# Cortex Code CLI — same MCP config
# Any MCP-compatible tool — same pattern
```

One install, works everywhere. The brain syncs between devices via sqlite-sync.

## Pre- and Post-Hooks

Moneypenny hooks into agent tool calls at two points:

**Pre-hooks** run before the agent acts:
- Enrich context with relevant facts and experience priors.
- Enforce policies (block destructive operations, require approval).
- Override or sanitize arguments.

**Post-hooks** run after the agent acts:
- Extract and store new facts from outputs.
- Record experience cases from failures.
- Log activity for the audit trail.
- Truncate or reformat outputs.

Hooks are pattern-matched by tool name (glob syntax) and chain naturally. This is how Moneypenny learns passively — it watches what happens and remembers what matters.

## Knowledge Ingestion

Feed Moneypenny any URL and it learns:

```
moneypenny_knowledge({ action: "ingest", input: { url: "https://docs.example.com/api" } })
```

Under the hood:
- Fetches and parses content (HTML, Markdown, plain text).
- Chunks intelligently using markdown-aware boundaries.
- Generates local embeddings via sqlite-ai (no data leaves your machine).
- Stores in sqlite-memory with hybrid search (vector similarity + FTS5).
- Content-hash deduplication — safe to re-ingest, only changes are processed.

Also supports:
- Directory ingestion (sync a docs folder, skip unchanged files).
- Inline text ingestion for ad-hoc knowledge.
- Codebase ingestion via file patterns.

## Scheduled Jobs

Natural language job definitions that run asynchronously:

```
"Every morning at 9am, search for facts older than 30 days with low confidence and compact them."
"Every 6 hours, poll the React docs URL for changes and re-ingest."
"Weekly on Monday, generate a summary of all experience cases from the past week."
```

Moneypenny translates intent into structured job specs with:
- Cron schedules
- Job types: prompt, tool, js (QuickJS scripts), pipeline (chained steps)
- Policy-checked execution (jobs respect the same guardrails as interactive use)
- Overlap policies (skip, queue, allow)
- Retry logic with exponential backoff
- Timeout enforcement

Jobs are first-class citizens, not an afterthought. They're how Moneypenny stays useful even when you're not actively working — monitoring sources, maintaining knowledge freshness, and surfacing what changed.

## Experience Engine

Moneypenny learns from failures:

- When a tool call fails, the error pattern is fingerprinted and stored as an **experience case**.
- When the same pattern recurs, Moneypenny surfaces prior context, attempted fixes, and outcomes.
- Successful resolutions are promoted to **experience fixes** with tracked success rates.
- Over time, the agent stops making the same mistakes — it has institutional memory.

This is especially powerful for recurring problems — build errors, environment issues, API quirks, anything where pattern recognition across sessions saves time.

## Policy Engine

User-controlled guardrails:

- **Deny rules** — block specific operations, tools, or patterns.
- **Audit rules** — log decisions without blocking.
- **Actor patterns** — scope rules to specific agents or channels.
- **SQL pattern matching** — block queries containing specific content.
- Per-operation and per-query policy evaluation with full audit trail.

Policies ensure Moneypenny stays within bounds you define. The agent is proactive but controlled.

## UI Layer

A lightweight web UI served directly from the Moneypenny process:

- **Dashboard** — brain health, fact counts, job status, recent activity.
- **Facts browser** — view, search, edit, and delete stored facts.
- **Knowledge explorer** — browse ingested documents and search semantically.
- **Job manager** — create, pause, resume, and monitor scheduled jobs.
- **Experience viewer** — review failure patterns and fixes.
- **Policy editor** — manage guardrails visually.
- **Composition inspector** — see exactly what context was assembled for each agent call.

Accessible at `localhost` when running, or served via MCP resource endpoints.

## Product Principles

1. **Local-first and user-owned.**
   Your intelligence data is a single SQLite file. Portable, inspectable, yours.

2. **One database, one brain.**
   No fragmented state across services. Everything the agent knows lives in one place.

3. **MCP-native.**
   First-class integration with agents via the standard protocol. Not a wrapper — a peer. Coding agents first, other surfaces next.

4. **Compounding intelligence.**
   Every session makes the next one better. Facts, experience, knowledge, and preferences accumulate.

5. **Safe autonomy.**
   Policies, hooks, and approval flows ensure the agent acts within your boundaries.

6. **Multi-device by default.**
   sqlite-sync means your brain follows you. Laptop, desktop, CI — same knowledge, always current.

## Parity Roadmap with Rust Implementation

The Rust Moneypenny (`moneypenny`) is the reference implementation. This TypeScript port (`moneypenny-js`) targets rough feature parity over time:

### Phase 1: Foundation
- [ ] SQLite schema (migrated from Rust v24)
- [ ] Core operations framework (request/response pattern)
- [ ] Facts store (CRUD + FTS5 search)
- [ ] Knowledge store (ingest, chunk, search)
- [ ] MCP sidecar (stdio transport)
- [ ] Domain tool routing (10 tools)
- [ ] Basic context engine (token-budget assembly)

### Phase 2: Intelligence
- [ ] sqlite-memory integration (hybrid vector + FTS5 search)
- [ ] sqlite-ai integration (local embeddings)
- [ ] Experience engine (failure patterns, fixes)
- [ ] Policy engine (deny/audit rules, evaluation)
- [ ] Session management (summaries, scratch pad)
- [ ] URL-based knowledge ingestion (fetch + parse + embed)

### Phase 3: Autonomy
- [ ] Scheduler (cron jobs, job types, retry logic)
- [ ] Pre/post hooks for tool calls
- [ ] Natural language job definitions
- [ ] Pipeline jobs (chained steps)
- [ ] Composition logging and audit trail
- [ ] Event log (unified append-only)

### Phase 4: Multi-Device + UI
- [ ] sqlite-sync integration (CRDT offline-first)
- [ ] Web UI (dashboard, facts browser, job manager)
- [ ] MCP HTTP transport (serve UI from MCP server)
- [ ] Brain checkpoint / restore / export
- [ ] Multi-brain support

## North Star

Install once, forget about it, and every agent you use gets smarter every day.

A new user should `bunx moneypenny sidecar`, add it to their editor's MCP config, and immediately have an agent with durable memory, searchable knowledge, and background intelligence — all running locally, all under their control.

Over time, Moneypenny becomes the intelligence layer you didn't know you needed: a private, compounding brain that knows your priorities, remembers your context, and works for you in the background. The coding sidecar is where it starts. It's not where it ends.
