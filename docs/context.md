# Future Agent Context

## Product

Future is an open-source, local, model-agnostic continuous assistant. It has one
durable timeline rather than multiple chats. Local events, imported sources,
memories, model calls, permissions, and proactive jobs will become searchable
lenses over the same assistant relationship.

The V2 source of truth is
`docs/superpowers/specs/2026-07-10-future-v2-continuous-assistant-design.md`.

## Current Branch State

The `v2` branch has completed Phase 1, Foundation and Connected Shell:

- ordered SQLite migrations with checksum verification
- stable API error envelopes
- local session-token and origin protection for `/api/v2` mutations
- provider and model-profile repositories
- mock and Ollama runtime resolution from persisted profiles
- V2 workspace, provider, model-profile, and health routes
- Vite proxy and typed browser API client
- browser-driven first-run setup using live local data

Legacy `/api` routes remain available during migration.

## Architecture

- `apps/api`: Fastify orchestration and local HTTP boundary
- `apps/web`: React command center and setup UI
- `packages/core`: shared contracts and pure domain types
- `packages/db`: migrations, SQLite connection, and repositories
- `packages/importers`: normalized source parsing
- `packages/memory`: memory extraction and state transitions
- `packages/retrieval`: FTS and context-pack selection
- `packages/providers`: model adapters
- `packages/permissions`: policy and redaction

## Verification

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm --filter @future/web build
corepack pnpm test:e2e
git diff --check
```

Playwright requires the pinned Chromium build:

```powershell
corepack pnpm exec playwright install chromium
```

## Next Boundary

Phase 2 is the Continuous Assistant Vertical Slice: persistent composer, assistant
turn orchestration, streamed mock/Ollama responses, live timeline events, context
inspection, and citations. Build it on the V2 session, provider-profile, and event
contracts rather than extending the legacy hard-coded command runner.
