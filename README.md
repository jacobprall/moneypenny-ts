# moneypenny-brain

[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=github&logoColor=white)](.github/workflows/ci.yml)

Local-first **Moneypenny brain**: SQLite + retrieval (FTS + vectors), knowledge ingestion, durable facts, policy engine, hooks, jobs, MCP + HTTP. CLI binary: **`mp`**.

## Requirements

- [Bun](https://bun.sh) 1.1+

## Quick start

```bash
bun install
bun run setup          # vendor extensions + embedding model (see script output)
mp init                # brain.toml + data dir (if not already)
bun run start          # or: mp serve — HTTP + MCP + scheduler
```

Default HTTP: `http://127.0.0.1:3123` (override with `BRAIN_HTTP_PORT` or `MP_HTTP_PORT`).

## Scripts

| Script | Purpose |
|--------|---------|
| `bun run setup` | Download SQLite extensions / model assets |
| `bun run typecheck` | `tsc --noEmit` (strict; `skipLibCheck` enabled) |
| `bun run verify-db` | Validate DB schema |
| `bun run smoke:http` | Hit `/health` and `/` (expects server already running) |
| `bun run test` | Behavior tests (`test/*.behavior.test.ts`) — in-memory SQLite, no vendor extensions |
| `bun run start` | Sidecar: HTTP + MCP stdio + background jobs |
| `bun run mp -- …` | CLI (`mp status`, `mp search`, …) |

## CLI (`mp`)

Common commands: `mp serve`, `mp status`, `mp search "…"`, `mp add-fact "…"`, `mp policy list`, `mp sync`, `mp session create|run|get`.

The `mp` executable is declared in `package.json` → `./src/cli.ts`.

## HTTP API (summary)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | `{ "status": "ok" }` |
| GET | `/` | Server metadata |
| GET/POST | `/api/context` | Brain context for a query |
| POST | `/api/events` | Append activity (via `execute` pipeline) |
| GET | `/api/events` | Query events |
| POST | `/api/facts`, `/api/facts/search` | Facts |
| POST | `/api/knowledge/ingest`, `/api/knowledge/search` | Knowledge |
| GET | `/api/knowledge`, `/api/jobs`, `/api/policies` | Lists |
| POST | `/api/policy/evaluate` | Policy decision |

All mutating routes go through **policy + hooks + audit** when routed via operations.

## MCP

Stdio MCP server registers tools as **`mp_*`** with legacy **`brainstorm_*`** aliases. Run via `bun run start` / `mp serve` (same process as HTTP).

## Continuous integration

- Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — Ubuntu, **Bun 1.2.19**, frozen lockfiles.
- Steps: install → brain `typecheck` + `test` → `packages/opencode-plugin` install + `typecheck` + `test`.
- Runs on push/PR to `main` and `master`, and manual **workflow_dispatch**.
- Dependabot: [`.github/dependabot.yml`](.github/dependabot.yml) (weekly Actions + Bun).
- Release automation: [`.github/workflows/release.yml`](.github/workflows/release.yml) (tag `v*` → verify + artifacts + GitHub release; optional npm publish for plugin when `NPM_TOKEN` exists).

After the repo is on GitHub, you can swap the badge for the live workflow status image from the Actions tab.

## Contribution hygiene

- PR template: [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)
- Issue templates: [`.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE)
- Ownership rules: [`.github/CODEOWNERS`](.github/CODEOWNERS) (currently `@jacobprall`; adjust if needed)

## Testing strategy

Tests target **observable behavior**, not private implementation:

| Layer | What runs | Purpose |
|--------|-----------|---------|
| **Domain** | `execute()`, `policy.evaluate` | Registry, persistence, policy matching (in-memory DB from `src/db/schema.sql`) |
| **HTTP** | `createHttpApp().request(...)` | Status codes and JSON shapes clients depend on — no TCP |
| **Smoke** | `bun run smoke:http` | Real server + networking (manual / CI with sidecar) |
| **OpenCode plugin** | `cd packages/opencode-plugin && bun test` | `BrainClient` + hooks helpers with mocked `fetch` |

Shared **test/support** opens a blank in-memory DB per scenario and restores global `setDb()` afterward. Operation registration is centralized in **`src/register-operations.ts`** (CLI, MCP, and tests).

## OpenCode plugin

The npm package **`@moneypenny/opencode-plugin`** lives in `packages/opencode-plugin`. It talks to this brain over HTTP (`MONEYPENNY_URL`). See repo root `moneypenny-js-opencode.md` for the full spec.

## Configuration

- `brain.toml` + env `BRAIN_*` — see `src/core/config.ts`
- Workspace docs: `BRAINSTORM.md` (architecture), `moneypenny-js-opencode.md` (OpenCode integration)

## License

Private project — see repository policy. (Published `@moneypenny/opencode-plugin` uses MIT in its `package.json`.)
