# @moneypenny/opencode-plugin

OpenCode plugin that connects sessions to the **moneypenny-brain** sidecar over HTTP.

## Prerequisites

1. Clone/install **moneypenny-brain** (`my-moneypenny-js` in this repo).
2. Run setup and start the sidecar:

```bash
bun install
bun run setup
mp serve
```

HTTP API defaults to `http://localhost:3123` (override with `BRAIN_HTTP_PORT` / `MP_HTTP_PORT` when starting the brain, or `MONEYPENNY_URL` in the environment where OpenCode runs).

## Install (OpenCode)

Add to `opencode.json`:

```json
{
  "plugin": ["@moneypenny/opencode-plugin@0.1.0"],
  "moneypenny": {
    "url": "http://localhost:3123",
    "context": { "enabled": true, "limit": 5, "maxChars": 2000 },
    "policy": { "enabled": true },
    "audit": { "enabled": true },
    "skipModelSubstrings": ["embed"]
  }
}
```

Environment variables still override defaults (`MONEYPENNY_URL`, toggles, TTL/LRU — see `src/runtime-options.ts`). For local development, use a `file:` URL pointing at this package’s `src/index.ts` (or a built entry) per OpenCode’s plugin loading rules.

## Features

- **System prompt:** Injects `<brain>…</brain>` context from retrieval (facts + knowledge) using the latest user message.
- **Tools:** `brain_search`, `brain_remember`, `brain_ingest`.
- **Audit:** Logs OpenCode tool calls to the brain `events` table (when the brain is reachable).
- **Policy:** `permission.ask` can be overridden by the brain policy engine (`allow` / `deny`).
- **Compaction:** Adds guidance so summaries preserve important decisions.

## Environment

| Variable | Default | Meaning |
|----------|---------|---------|
| `MONEYPENNY_URL` | `http://localhost:3123` | Brain HTTP base URL |
| `MONEYPENNY_CONTEXT_ENABLED` | `1` | Set `0` to disable prompt injection |
| `MONEYPENNY_POLICY_ENABLED` | `1` | Set `0` to skip policy hook |
| `MONEYPENNY_AUDIT_ENABLED` | `1` | Set `0` to skip tool/event audit |
| `MONEYPENNY_SKIP_MODELS` | (built-in list) | Extra comma-separated substrings; if `model.id` contains one, skip brain context |
| `MONEYPENNY_HEALTH_TTL_MS` | `3000` | Cache `/health` result to avoid hitting the brain every hook |
| `MONEYPENNY_PROMPT_LRU_MAX` | `256` | Max sessions tracked for “last user message” context |
| `MONEYPENNY_CALL_TIMER_MAX_MS` | `600000` | Drop stale tool-call timers after this age |

## Tests

From this package directory:

```bash
bun test
bun run typecheck
```

## Policy note

HTTP writes use actor `http`. If you use `deny_by_default = true` in `brain.toml`, add policies that allow `activity.append`, `facts.add`, `knowledge.*`, etc., for actor `http` (or your chosen patterns).
