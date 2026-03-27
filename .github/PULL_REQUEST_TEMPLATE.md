## Summary

- What changed?
- Why did we make this change?

## Scope

- [ ] Brain runtime (`src/`, `scripts/`, `test/`)
- [ ] OpenCode plugin (`packages/opencode-plugin`)
- [ ] CI / GitHub automation
- [ ] Docs

## Validation

- [ ] `bun run typecheck`
- [ ] `bun run test`
- [ ] `cd packages/opencode-plugin && bun run typecheck && bun test`
- [ ] (if applicable) `bun run smoke:http` with `mp serve` running

## Risks / Rollback

- Risk level: low / medium / high
- Rollback plan:

## Checklist

- [ ] Behavior-focused tests added or updated
- [ ] No secrets / credentials committed
- [ ] Backwards compatibility considered (or explicitly breaking)
- [ ] Docs updated where needed
