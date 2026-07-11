# Future Agent Context

## Product

Future is an open-source, local, model-agnostic continuous assistant. It has one
durable timeline rather than multiple chats. Local events, imported sources,
memories, model calls, permissions, and proactive jobs will become searchable
lenses over the same assistant relationship.

The V2 source of truth is
`docs/superpowers/specs/2026-07-10-future-v2-continuous-assistant-design.md`.

## Current Branch State

The `codex/phase3-memory-retrieval` branch has completed Phase 3, Memory and
Hybrid Retrieval. It retains the completed Phase 2 continuous-assistant slice and adds:

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
- migration `0003_memory_hybrid_retrieval` with memory/event/compaction FTS,
  namespaces, memberships, embeddings, and compaction provenance
- workspace-scoped FTS across document chunks, approved active memories,
  text-bearing events, and active compactions
- deterministic hybrid ranking, context budgeting, overlap/hash deduplication,
  source diversity, pin/confidence/recency boosts, and ranking explanations
- optional noop, Ollama, and OpenAI-compatible embedding adapters; adapter
  failure degrades safely to lexical retrieval
- shallow virtual namespaces, optimistic memory revisions, review/edit/pin/
  outdate/delete flows, retrieval tombstones, and source-linked compaction
- protected V2 memory, namespace, revision, compaction, and search resources
- connected browser Memory lens with persistent composer and browser-only
  lifecycle coverage proving memory changes alter later context selection

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

Phase 4 adds browser file/ChatGPT import, resumable indexing work, persisted
OpenAI-compatible text generation, whole-prompt redaction, and immutable external
prompt-preview grants. It must reuse the Phase 3 source, retrieval, context-pack,
and memory contracts.
