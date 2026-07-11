# Future Agent Context

## Product

Future is an open-source, local, model-agnostic continuous assistant. It has one
durable timeline rather than multiple chats. Local events, imported sources,
memories, model calls, permissions, and proactive jobs will become searchable
lenses over the same assistant relationship.

The V2 source of truth is
`docs/superpowers/specs/2026-07-10-future-v2-continuous-assistant-design.md`.

## Current Branch State

The `v2` branch has completed Phase 2, Continuous Assistant Vertical Slice:

- ordered SQLite migrations with checksum verification
- stable API error envelopes
- local session-token and origin protection for `/api/v2` mutations
- provider and model-profile repositories
- mock and Ollama runtime resolution from persisted profiles
- V2 workspace, provider, model-profile, and health routes
- Vite proxy and typed browser API client
- browser-driven first-run setup using live local data
- one persistent composer over the active workspace lens
- idempotent assistant turns correlated across user events, context packs, model calls, and answers
- incremental mock and Ollama streaming over protected V2 SSE routes
- live SQLite timeline polling with persisted user, assistant, failure, and cancellation events
- hybrid context assembly from approved memories, document chunks, and recent events
- separately stored source citations and immutable context-pack inspection
- browser-only Playwright coverage for setup, streaming, citations, inspection, and reload durability

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

## Assistant Flow

The browser creates an idempotent turn through `/api/v2/assistant-turns`, consumes
its protected SSE stream, and polls `/api/v2/timeline` from the last event cursor.
The API persists the user event before model execution. Completion, cancellation,
and provider failure are terminal persisted outcomes. Completed answers attach
normalized citations separately from response text and reference an immutable
context pack available through `/api/v2/context-packs/:id`.

Legacy `/api` routes remain available during migration, but the connected browser
assistant uses V2 contracts.

## Next Boundary

Phase 3 expands memory and retrieval management: memory namespaces and revisions,
review/edit/outdate/delete UI, full event and memory FTS ranking, optional embedding
adapters, and compaction. It must extend the Phase 2 turn/context contracts rather
than creating a parallel conversation flow.
