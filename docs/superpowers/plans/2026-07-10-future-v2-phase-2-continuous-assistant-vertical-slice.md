# Future V2 Phase 2 Continuous Assistant Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one persistent browser composer backed by idempotent, persisted assistant turns that assemble hybrid local context, stream mock or Ollama output, write live SQLite timeline events, expose citations and context inspection, and record cancellation and failure outcomes.

**Architecture:** Extend the existing modular monolith rather than the legacy command runner. `@future/core` owns serialized V2 turn, stream, timeline, source-reference, and context-pack contracts; `@future/db` owns the Phase 2 migration and focused repositories; `@future/retrieval` ranks normalized memory, document, and event candidates; `apps/api` coordinates context, providers, transactions, SSE, cancellation, and safe failures; `apps/web` consumes only V2 assistant endpoints and keeps one composer beneath the SQLite-backed timeline. Existing `/api` routes remain compatible during migration.

**Tech Stack:** TypeScript 6, Node.js 24+, pnpm 11.9.0, Fastify 5, React 19, Vite 8, SQLite/better-sqlite3, Vitest 4, Testing Library, Server-Sent Events over `fetch`, Playwright 1.61.1.

## Global Constraints

- Work only on branch `v2`; do not merge into `main` and do not push.
- Phase 1 is complete; extend its migration, session, provider-profile, typed-client, and connected-shell contracts instead of rebuilding them.
- Preserve existing MVP data and legacy `/api` behavior while the browser assistant flow uses `/api/v2`.
- Keep one user-visible assistant and one timeline; `assistant_turns` is execution correlation, not a conversation selector.
- Persist the user event before provider execution and persist final, failed, or cancelled state before ending the stream.
- Use persisted provider and model-profile records; do not accept arbitrary provider URLs or model names in assistant-turn requests.
- Retrieve only approved, non-outdated memories; constrain documents and timeline events to the active workspace.
- Store citations separately from rendered response text and expose the immutable persisted context pack to the inspector.
- Never persist secrets, prompt bodies in failure events, or raw provider errors returned to the browser.
- Use Fastify schemas with `additionalProperties: false` for every Phase 2 mutation.
- Follow TDD for every behavior: write the test, observe the expected failure, implement the minimum behavior, rerun focused and affected tests, then commit.
- Do not add a client state-management, data-fetching, Markdown-rendering, or SSE dependency.
- The Phase 2 checkpoint requires `corepack pnpm check`, `corepack pnpm --filter @future/web build`, `corepack pnpm test:e2e`, and `git diff --check`.

---

## File Structure Map

### Shared contracts and persistence

- Create `packages/core/src/assistant.ts`: turn states, create input/DTOs, stream frames, normalized source references, timeline DTOs, and context inspection DTOs.
- Test `packages/core/src/assistant.test.ts`: serialized contract helper behavior.
- Create `packages/db/src/migrations/0002-continuous-assistant.ts`: `assistant_turns`, turn lookup index, and assistant response source storage.
- Modify `packages/db/src/migrations/runner.ts`: append the immutable Phase 2 migration.
- Test `packages/db/src/migrations/runner.test.ts`: clean application, one-time upgrade, and existing-data preservation.
- Create `packages/db/src/repositories/assistant-turns.ts` and its test: idempotent creation and legal terminal transitions.
- Create `packages/db/src/repositories/context-packs.ts` and its test: immutable context pack persistence and inspection.
- Modify `packages/db/src/repositories/events.ts` and its test: stable cursor/ascending reads plus event source attachment.
- Modify `packages/db/src/index.ts`: export the new repositories.

### Retrieval and providers

- Modify `packages/retrieval/src/context-pack.ts` and its test: preserve normalized source metadata, deterministic diversity, and token budgets.
- Create `apps/api/src/services/context-service.ts` and its test: select approved memories, document FTS hits, and recent citable events from the active workspace, then persist one immutable pack.
- Modify `packages/core/src/providers.ts`: accept an optional `AbortSignal` in `ModelTextRequest`.
- Modify `packages/providers/src/mock.ts` and its test: deterministic multi-chunk streaming with cancellation checks.
- Modify `packages/providers/src/ollama.ts` and add `packages/providers/src/ollama.test.ts`: request Ollama streaming and parse newline-delimited JSON chunks.

### Assistant orchestration and V2 API

- Create `apps/api/src/services/assistant-service.ts` and its test: turn lifecycle, prompt construction, provider streaming, final persistence, cancellation, and failure persistence.
- Create `apps/api/src/services/turn-cancellation.ts` and its test: process-local `AbortController` registry for active turns.
- Modify `apps/api/src/server/dependencies.ts` and `apps/api/src/server/create-server.ts`: construct and inject repositories/services once.
- Create `apps/api/src/routes/v2/assistant-turns.ts` and its test: create/idempotency, SSE stream, cancel, and turn inspection routes.
- Create `apps/api/src/routes/v2/timeline.ts` and its test: SQLite timeline reads with cursor metadata.
- Create `apps/api/src/routes/v2/context-packs.ts` and its test: immutable context inspector response.

### Browser vertical slice

- Modify `apps/web/src/app/api-types.ts`: V2 assistant, stream, timeline, cancellation, and context inspector methods.
- Modify `apps/web/src/app/api-client.ts` and its test: authenticated mutations plus streaming SSE parser.
- Create `apps/web/src/features/timeline/use-timeline.ts` and its test: initial load, live polling while mounted, and explicit refresh after turn frames.
- Create `apps/web/src/features/assistant/use-assistant-turn.ts` and its test: submit, incremental text, completion, cancellation, and visible failure state.
- Create `apps/web/src/features/assistant/AssistantComposer.tsx` and its test: persistent accessible composer and cancel control.
- Rewrite `apps/web/src/features/timeline/TimelineView.tsx` and add its test: real ordered user/assistant/system events and citation selection.
- Create `apps/web/src/features/assistant/ContextInspector.tsx` and its test: exact context items, citations, provider/model metadata, and empty selection.
- Modify `apps/web/src/features/assistant/AssistantResponse.tsx`, `apps/web/src/app/App.tsx`, `apps/web/src/app/App.test.tsx`, and `apps/web/src/styles/global.css`: connect the complete responsive flow.
- Rewrite `tests/e2e/hero-flow.spec.ts`: browser-only setup, streamed assistant request, persisted timeline, citations, context inspection, and reload durability.

---

### Task 1: V2 Assistant Contracts and Phase 2 Migration

**Files:**
- Create: `packages/core/src/assistant.ts`
- Test: `packages/core/src/assistant.test.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/db/src/migrations/0002-continuous-assistant.ts`
- Modify: `packages/db/src/migrations/runner.ts`
- Test: `packages/db/src/migrations/runner.test.ts`

**Interfaces:**
- Consumes: `TimelineEvent`, `ModelProfile`, existing migration ordering/checksum semantics.
- Produces: `AssistantTurnState`, `AssistantTurnDto`, `CreateAssistantTurnInput`, `AssistantStreamFrame`, `SourceReference`, `ContextPackInspection`, `TimelineEventDto`, and migration `0002_continuous_assistant`.

- [ ] **Step 1: Write failing shared-contract tests**

Add tests that call `serializeTimelineEvent` with a real `Date` and assert an ISO `createdAt`, and call `sourceReferenceKey` for a memory and document range and assert stable keys.

```ts
const serialized = serializeTimelineEvent(createEvent({
  workspaceId: "w_demo",
  type: "user.message.created",
  actor: "user",
  title: "Asked Future",
  payload: { text: "What did we decide?" },
  privacy: { labels: ["local"] }
}));
expect(serialized.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
expect(sourceReferenceKey({ kind: "memory", id: "mem_1", workspaceId: "w_demo", title: "Decision", contentHash: "abc" })).toBe("memory:mem_1:abc");
```

- [ ] **Step 2: Run core tests and verify red**

Run: `corepack pnpm --filter @future/core test -- src/assistant.test.ts`

Expected: FAIL because `assistant.ts` and its exports do not exist.

- [ ] **Step 3: Define the shared assistant contracts**

Use these exact public shapes in `packages/core/src/assistant.ts`:

```ts
export type AssistantTurnState =
  | "queued" | "building_context" | "running"
  | "completed" | "failed" | "cancelled";

export interface SourceReference {
  kind: "memory" | "document_chunk" | "timeline_event";
  id: string;
  workspaceId: string;
  title: string;
  contentHash: string;
  range?: { start: number; end: number };
}

export interface CreateAssistantTurnInput {
  workspaceId: string;
  modelProfileId: string;
  idempotencyKey: string;
  message: string;
}

export interface AssistantTurnDto {
  id: string;
  workspaceId: string;
  modelProfileId: string;
  idempotencyKey: string;
  state: AssistantTurnState;
  userEventId: string;
  contextPackId?: string;
  modelCallId?: string;
  assistantEventId?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type AssistantStreamFrame =
  | { type: "started"; turn: AssistantTurnDto }
  | { type: "context"; contextPackId: string; sourceCount: number }
  | { type: "delta"; text: string }
  | { type: "completed"; turn: AssistantTurnDto; event: TimelineEventDto; citations: SourceReference[] }
  | { type: "cancelled"; turn: AssistantTurnDto }
  | { type: "failed"; turn: AssistantTurnDto; message: string };
```

`ContextPackInspection` contains `id`, `workspaceId`, `turnId`, `modelProfileId`, `providerId`, `model`, `items`, `estimatedTokens`, `redactionCount`, and `createdAt`. Each item contains `source`, `text`, `tokenCount`, and `score`. Export all contracts from `packages/core/src/index.ts`.

- [ ] **Step 4: Write the failing Phase 2 migration test**

Extend `runner.test.ts` to assert a clean database records `0001_initial` then `0002_continuous_assistant`, rerunning records neither twice, an existing workspace survives, and `PRAGMA table_info(assistant_turns)` contains `idempotency_key`, `context_pack_id`, and `assistant_event_id`.

- [ ] **Step 5: Run the migration test and verify red**

Run: `corepack pnpm --filter @future/db test -- src/migrations/runner.test.ts`

Expected: FAIL because only `0001_initial` is registered.

- [ ] **Step 6: Implement the forward-only migration**

Create `0002-continuous-assistant.ts` with checksum derived from its SQL statements. Create:

```sql
CREATE TABLE assistant_turns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  model_profile_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  state TEXT NOT NULL,
  user_event_id TEXT NOT NULL,
  context_pack_id TEXT,
  model_call_id TEXT,
  assistant_event_id TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, idempotency_key)
);
CREATE INDEX assistant_turns_workspace_created_idx
  ON assistant_turns (workspace_id, created_at DESC);
CREATE TABLE assistant_response_sources (
  event_id TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_json TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  PRIMARY KEY (event_id, source_kind, source_id)
);
```

Append `continuousAssistantMigration` after `initialMigration` in `migrations`; never modify the checksum or SQL of `0001_initial`.

- [ ] **Step 7: Verify core and database green**

Run: `corepack pnpm --filter @future/core test && corepack pnpm --filter @future/db test`

Expected: all core and database tests pass, including the two-migration order and upgrade preservation assertions.

- [ ] **Step 8: Commit the contracts and migration**

```powershell
git add packages/core/src packages/db/src/migrations
git commit -m "feat: add continuous assistant contracts"
```

---

### Task 2: Assistant, Context-Pack, and Event Repositories

**Files:**
- Create: `packages/db/src/repositories/assistant-turns.ts`
- Test: `packages/db/src/repositories/assistant-turns.test.ts`
- Create: `packages/db/src/repositories/context-packs.ts`
- Test: `packages/db/src/repositories/context-packs.test.ts`
- Modify: `packages/db/src/repositories/events.ts`
- Test: `packages/db/src/repositories/events.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: Phase 2 tables and `AssistantTurnDto`, `SourceReference`, `TimelineEvent`.
- Produces: `AssistantTurnRepository`, `ContextPackRepository`, cursor-based event reads, and citation attachment/listing.

- [ ] **Step 1: Write failing repository tests**

Cover these behaviors with a fresh `createTestDb()` per test:

```ts
const first = turns.create({ workspaceId: "w_demo", modelProfileId: "profile_1", idempotencyKey: "key_1", message: "Hello" });
const replay = turns.create({ workspaceId: "w_demo", modelProfileId: "profile_1", idempotencyKey: "key_1", message: "Hello" });
expect(replay).toEqual({ turn: first.turn, replayed: true });

const updated = turns.updateState(first.turn.id, "building_context", { contextPackId: "ctx_1" });
expect(updated.state).toBe("building_context");
expect(() => turns.updateState(first.turn.id, "queued")).toThrow(/invalid turn transition/);
```

Also persist a context pack, read it back with unchanged item order/source metadata, attach two sources to an assistant event, and list events `after` a cursor in ascending order without returning the cursor event twice.

- [ ] **Step 2: Run focused database tests and verify red**

Run: `corepack pnpm --filter @future/db test -- src/repositories/assistant-turns.test.ts src/repositories/context-packs.test.ts src/repositories/events.test.ts`

Expected: FAIL because the turn/context repositories and cursor/source methods are missing.

- [ ] **Step 3: Implement `AssistantTurnRepository`**

Expose only:

```ts
class AssistantTurnRepository {
  create(input: CreateAssistantTurnInput): { turn: AssistantTurnDto; replayed: boolean };
  get(id: string): AssistantTurnDto | undefined;
  getByIdempotencyKey(workspaceId: string, key: string): AssistantTurnDto | undefined;
  updateState(id: string, state: AssistantTurnState, refs?: {
    contextPackId?: string; modelCallId?: string; assistantEventId?: string; errorCode?: string;
  }): AssistantTurnDto;
}
```

`create` writes `user.message.created` and `assistant_turns` in one SQLite transaction. The event payload contains `{ text, turnId }`. Permit only `queued -> building_context|cancelled`, `building_context -> running|failed|cancelled`, and `running -> completed|failed|cancelled`; terminal states reject further transitions. On the unique-key conflict, compare workspace, profile, and message payload, returning the existing turn only when all match; otherwise throw `AssistantTurnConflictError`.

- [ ] **Step 4: Implement immutable context packs and event citations**

`ContextPackRepository.create(pack)` inserts the existing `context_packs` row with `items_json` containing ordered `ContextPackInspection["items"]`; `get(id)` joins the model profile and provider to return inspector metadata. It exposes no update method.

Extend `EventRepository` with:

```ts
list(options: EventListOptions & { after?: string; order?: "asc" | "desc" }): TimelineEvent[];
attachSources(eventId: string, sources: readonly SourceReference[]): void;
listSources(eventId: string): SourceReference[];
```

Resolve `after` using the cursor event's `(created_at, id)` tuple and keep deterministic ordering by both columns.

- [ ] **Step 5: Run database tests and verify green**

Run: `corepack pnpm --filter @future/db test`

Expected: repository, migration, cursor, source-order, idempotency, and transition tests all pass.

- [ ] **Step 6: Commit persistence repositories**

```powershell
git add packages/db/src
git commit -m "feat: persist assistant turns and context"
```

---

### Task 3: Streaming Provider Contracts

**Files:**
- Modify: `packages/core/src/providers.ts`
- Modify: `packages/providers/src/mock.ts`
- Test: `packages/providers/src/mock.test.ts`
- Modify: `packages/providers/src/ollama.ts`
- Create: `packages/providers/src/ollama.test.ts`

**Interfaces:**
- Consumes: persisted runtime selection from `ProviderService`.
- Produces: genuinely incremental mock/Ollama `AsyncIterable<ModelTextChunk>` streams honoring `AbortSignal`.

- [ ] **Step 1: Write failing provider tests**

Assert the mock provider yields more than one non-empty chunk whose concatenation is deterministic. Mock Ollama `fetch` with a `ReadableStream` containing split NDJSON boundaries:

```ts
const body = new ReadableStream({
  start(controller) {
    controller.enqueue(encoder.encode('{"response":"Local ","done":false}\n{"res'));
    controller.enqueue(encoder.encode('ponse":"answer","done":true}\n'));
    controller.close();
  }
});
```

Assert concatenation equals `Local answer`, the request body contains `stream: true`, and an already-aborted signal throws an `AbortError` without yielding text.

- [ ] **Step 2: Run provider tests and verify red**

Run: `corepack pnpm --filter @future/providers test`

Expected: FAIL because mock yields one chunk, Ollama requests `stream: false`, and request signals are unsupported.

- [ ] **Step 3: Add signal-aware model requests and incremental mock output**

Add `signal?: AbortSignal` to `ModelTextRequest`. Split the mock response on whitespace while preserving separators and call `request.signal?.throwIfAborted()` before every yield. Keep output deterministic and do not add artificial production delays.

- [ ] **Step 4: Parse Ollama NDJSON streaming responses**

Pass `signal` to `fetch`, request `stream: true`, require `response.body`, decode with `TextDecoderStream` semantics implemented through `getReader()` plus a carry buffer, parse one JSON line at a time, yield each non-empty `response`, stop at `done: true`, and throw a named safe adapter error for malformed JSON or missing bodies.

- [ ] **Step 5: Run core/provider/API tests**

Run: `corepack pnpm --filter @future/core test && corepack pnpm --filter @future/providers test && corepack pnpm --filter @future/api test -- src/services/provider-service.test.ts`

Expected: all affected contract, adapter, and runtime-resolution tests pass.

- [ ] **Step 6: Commit provider streaming**

```powershell
git add packages/core/src/providers.ts packages/providers/src
git commit -m "feat: stream mock and ollama responses"
```

---

### Task 4: Hybrid Context Assembly with Citations

**Files:**
- Modify: `packages/retrieval/src/context-pack.ts`
- Test: `packages/retrieval/src/context-pack.test.ts`
- Create: `apps/api/src/services/context-service.ts`
- Test: `apps/api/src/services/context-service.test.ts`
- Modify: `apps/api/src/server/dependencies.ts`

**Interfaces:**
- Consumes: approved memories, `searchLexical`, recent text-bearing timeline events, model context window, and `ContextPackRepository`.
- Produces: `ContextService.buildForTurn(input): ContextPackInspection` containing normalized citable sources from all three local layers.

- [ ] **Step 1: Write failing retrieval diversity tests**

Pass a high-scoring memory, document chunk, and recent event with `SourceReference` metadata. Assert all fit, source metadata survives, score ordering is deterministic, duplicate `kind/id/contentHash` entries collapse, and total tokens never exceed the budget.

- [ ] **Step 2: Run retrieval tests and verify red**

Run: `corepack pnpm --filter @future/retrieval test -- src/context-pack.test.ts`

Expected: FAIL because candidates do not carry source references or deduplicate.

- [ ] **Step 3: Extend the pure context-pack builder**

Change `ContextCandidate` to `{ source, text, tokenCount, score }`. Deduplicate with `sourceReferenceKey`, prefer the highest score, sort by score then source key, and select within `budgetTokens`. Preserve `kind` through `source.kind` instead of maintaining parallel IDs.

- [ ] **Step 4: Write failing `ContextService` integration tests**

Seed one approved memory and one proposed memory, index a matching document chunk, append an earlier user/assistant event, then build for query `SQLite local decision`. Assert the pack contains the approved memory, chunk, and prior event; excludes the proposed memory and the current turn's user event; contains stable hashes/ranges/titles; uses only the requested workspace; and is readable through `ContextPackRepository.get`.

- [ ] **Step 5: Run the service test and verify red**

Run: `corepack pnpm --filter @future/api test -- src/services/context-service.test.ts`

Expected: FAIL because `ContextService` does not exist.

- [ ] **Step 6: Implement hybrid SQLite context assembly**

`ContextService` accepts the database, event repository, context-pack repository, and clock/hash helpers. Its `buildForTurn`:

1. Selects up to 12 approved, non-outdated workspace memories, always including pinned records and scoring keyword overlap plus confidence/pinning.
2. Calls `searchLexical` for up to 12 workspace document chunks and loads full chunk text/document title/hash/range for citation fidelity.
3. Reads up to 20 earlier workspace events and extracts text only from `user.message.created` and `assistant.response.created` payloads.
4. Excludes the current user event and technical lifecycle events.
5. Uses `budgetTokens = max(256, min(profile.contextWindow - 512, 4096))`.
6. Persists exactly one immutable pack with provider/model metadata and returns it.

Use SHA-256 over source text when a durable hash is not already stored. Do not write prompt text into timeline events.

- [ ] **Step 7: Run retrieval and API service tests**

Run: `corepack pnpm --filter @future/retrieval test && corepack pnpm --filter @future/api test -- src/services/context-service.test.ts`

Expected: hybrid selection, workspace isolation, approval filtering, citation fidelity, deduplication, and token-budget tests pass.

- [ ] **Step 8: Commit hybrid context assembly**

```powershell
git add packages/retrieval/src apps/api/src/services apps/api/src/server/dependencies.ts
git commit -m "feat: assemble cited hybrid context"
```

---

### Task 5: Assistant-Turn Orchestration, Cancellation, and Failure Persistence

**Files:**
- Create: `apps/api/src/services/turn-cancellation.ts`
- Test: `apps/api/src/services/turn-cancellation.test.ts`
- Create: `apps/api/src/services/assistant-service.ts`
- Test: `apps/api/src/services/assistant-service.test.ts`
- Modify: `apps/api/src/server/dependencies.ts`
- Modify: `apps/api/src/server/create-server.ts`

**Interfaces:**
- Consumes: `AssistantTurnRepository`, `ContextService`, `ProviderService`, `EventRepository`, SQLite, and signal-aware providers.
- Produces: `AssistantService.createTurn`, `AssistantService.streamTurn`, `AssistantService.cancelTurn`, and one terminal persisted lifecycle for each turn.

- [ ] **Step 1: Write failing cancellation-registry tests**

Assert `start(turnId)` returns a signal, `cancel(turnId)` aborts only that signal, duplicate active registration throws, and `finish(turnId)` removes it so later cancellation returns `false`.

- [ ] **Step 2: Run registry tests and verify red**

Run: `corepack pnpm --filter @future/api test -- src/services/turn-cancellation.test.ts`

Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement the small cancellation registry**

Use a private `Map<string, AbortController>` and expose `start`, `cancel`, and `finish`. Do not store controllers in SQLite or global module state; inject one registry per server.

- [ ] **Step 4: Write failing assistant lifecycle tests**

With a temporary SQLite database and fake async providers, cover:

- create persists `queued` plus `user.message.created`; same idempotency input replays one turn/event
- stream transitions `building_context -> running -> completed`, yields multiple deltas, persists model call usage/output metadata, assistant response, citations, and terminal turn references
- provider throw transitions to `failed`, writes `model_call.failed` and `assistant.turn.failed`, yields a safe failed frame, and writes no completed assistant response
- abort after one delta transitions to `cancelled`, writes `model_call.cancelled` and `assistant.turn.cancelled` with partial character count, yields cancelled, and writes no completed assistant response
- streaming a completed or active turn does not execute the provider twice

- [ ] **Step 5: Run assistant service tests and verify red**

Run: `corepack pnpm --filter @future/api test -- src/services/assistant-service.test.ts`

Expected: FAIL because `AssistantService` does not exist.

- [ ] **Step 6: Implement turn orchestration**

Expose:

```ts
class AssistantService {
  createTurn(input: CreateAssistantTurnInput): { turn: AssistantTurnDto; replayed: boolean };
  streamTurn(turnId: string): AsyncIterable<AssistantStreamFrame>;
  cancelTurn(turnId: string): AssistantTurnDto;
  getTurn(turnId: string): AssistantTurnDto | undefined;
}
```

`streamTurn` resolves the persisted profile/provider, builds and persists context, inserts a `model_calls` row, and constructs the prompt as the user message followed by a clearly delimited `Local context` list with citation ordinals. It yields `started`, `context`, and provider `delta` frames. On success, one transaction completes the model call and turn, appends `model_call.completed` and `assistant.response.created`, and attaches ordered context sources to the assistant event. On `AbortError`, one transaction records cancelled statuses/events and safe partial character metadata. On any other error, one transaction records failed statuses/events with a stable `provider_error` code and no raw prompt/body. Always remove the active controller in `finally`.

- [ ] **Step 7: Run focused and full API tests**

Run: `corepack pnpm --filter @future/api test -- src/services/assistant-service.test.ts src/services/context-service.test.ts src/services/provider-service.test.ts`

Expected: all orchestration/service tests pass.

Run: `corepack pnpm --filter @future/api test`

Expected: all legacy and V2 API tests pass.

- [ ] **Step 8: Commit assistant orchestration**

```powershell
git add apps/api/src/services apps/api/src/server
git commit -m "feat: orchestrate persistent assistant turns"
```

---

### Task 6: Protected V2 Assistant, Timeline, and Inspector Routes

**Files:**
- Create: `apps/api/src/routes/v2/assistant-turns.ts`
- Test: `apps/api/src/routes/v2/assistant-turns.test.ts`
- Create: `apps/api/src/routes/v2/timeline.ts`
- Test: `apps/api/src/routes/v2/timeline.test.ts`
- Create: `apps/api/src/routes/v2/context-packs.ts`
- Test: `apps/api/src/routes/v2/context-packs.test.ts`
- Modify: `apps/api/src/server/create-server.ts`

**Interfaces:**
- Consumes: Phase 2 services/repositories and Phase 1 session/error envelope.
- Produces: create/get/stream/cancel turn routes, SQLite timeline reads, and persisted context inspection.

- [ ] **Step 1: Write failing V2 route tests**

Using `server.inject` and `x-future-session: test-token`, assert:

```text
POST /api/v2/assistant-turns                 -> 201, or 200 with replayed=true
GET  /api/v2/assistant-turns/:id             -> persisted turn
POST /api/v2/assistant-turns/:id/stream      -> text/event-stream frames ending completed
POST /api/v2/assistant-turns/:id/cancel      -> cancelled turn or 409 when terminal
GET  /api/v2/timeline?workspaceId=w_demo     -> serialized SQLite events and nextCursor
GET  /api/v2/context-packs/:id               -> immutable items, sources, provider/model metadata
```

Assert missing session tokens fail on create/stream/cancel, extra body properties fail validation, unknown IDs return the stable `not_found` envelope, mismatched duplicate idempotency returns `conflict`, and a failing provider stream still ends with a persisted failed event.

- [ ] **Step 2: Run route tests and verify red**

Run: `corepack pnpm --filter @future/api test -- src/routes/v2`

Expected: FAIL because the Phase 2 routes are missing.

- [ ] **Step 3: Implement assistant-turn routes and SSE framing**

The create schema requires exactly `workspaceId`, `modelProfileId`, `idempotencyKey`, and non-blank `message`. The stream route sets `content-type: text/event-stream; charset=utf-8`, `cache-control: no-cache`, and `connection: keep-alive`, then writes each frame as:

```ts
reply.raw.write(`event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`);
```

Use `reply.hijack()` only after validation and service lookup succeed. End the raw response after a terminal frame. If the client socket closes, request cancellation for the active turn. Route handlers translate typed service conflicts/not-found/terminal errors into the V2 error envelope.

- [ ] **Step 4: Implement SQLite timeline and context inspection routes**

Timeline requires `workspaceId`; accepts `after` and integer `limit` from 1 to 100; returns events in ascending order with each event's separately stored citations and `nextCursor` equal to the final event ID. Context inspection returns only a pack in the same workspace as its turn and never reconstructs data from current mutable memories/documents.

- [ ] **Step 5: Register routes and run API green**

Register session protection before all Phase 2 routes, then assistant turns, V2 timeline, and V2 context packs before legacy routes.

Run: `corepack pnpm --filter @future/api test`

Expected: validation, session, SSE, idempotency, persistence, cancellation, failure, timeline cursor, inspector, and all legacy tests pass.

- [ ] **Step 6: Commit the V2 assistant API**

```powershell
git add apps/api/src/routes/v2 apps/api/src/server/create-server.ts
git commit -m "feat: expose v2 assistant streaming api"
```

---

### Task 7: Browser Streaming Client and Live SQLite Timeline State

**Files:**
- Modify: `apps/web/src/app/api-types.ts`
- Modify: `apps/web/src/app/api-client.ts`
- Test: `apps/web/src/app/api-client.test.ts`
- Create: `apps/web/src/features/timeline/use-timeline.ts`
- Test: `apps/web/src/features/timeline/use-timeline.test.tsx`
- Create: `apps/web/src/features/assistant/use-assistant-turn.ts`
- Test: `apps/web/src/features/assistant/use-assistant-turn.test.tsx`

**Interfaces:**
- Consumes: protected V2 assistant endpoints and SSE frames.
- Produces: a typed async frame stream, cancellable turn state, and live timeline/context refresh callbacks.

- [ ] **Step 1: Write failing API-client stream tests**

Mock a `Response.body` whose chunks split SSE lines and JSON payloads. Assert `streamAssistantTurn` yields `started`, two `delta`, and `completed` frames in order; ignores SSE comments/blank records; throws the stable API message for a non-2xx response; and includes the cached session header. Add tests for create, cancel, timeline cursor, and context-pack GET paths.

- [ ] **Step 2: Run client tests and verify red**

Run: `corepack pnpm --filter @future/web test -- src/app/api-client.test.ts`

Expected: FAIL because assistant API methods and SSE parsing are absent.

- [ ] **Step 3: Implement the typed browser API surface**

Extend `FutureApi` with:

```ts
createAssistantTurn(input: CreateAssistantTurnInput): Promise<{ turn: AssistantTurnDto; replayed: boolean }>;
streamAssistantTurn(id: string): AsyncIterable<AssistantStreamFrame>;
cancelAssistantTurn(id: string): Promise<AssistantTurnDto>;
listTimeline(workspaceId: string, after?: string): Promise<{ events: TimelineEventDto[]; nextCursor?: string }>;
getContextPack(id: string): Promise<ContextPackInspection>;
```

Refactor the private mutation helper to support `POST` responses that are JSON or streaming without duplicating session acquisition/error handling. Parse SSE incrementally with `TextDecoder`, a carry buffer, and blank-record boundaries.

- [ ] **Step 4: Write failing timeline and turn-hook tests**

Use fake timers for `useTimeline`: initial load populates events, a 750 ms poll appends only unseen events, workspace changes reset the cursor/list, unmount clears polling, and `refresh()` fetches immediately. For `useAssistantTurn`, assert submit creates and streams, deltas concatenate, completion calls timeline refresh and selects the context pack, cancellation calls the API, and failed frames expose their safe message while preserving the composer input for retry.

- [ ] **Step 5: Run hook tests and verify red**

Run: `corepack pnpm --filter @future/web test -- src/features/timeline/use-timeline.test.tsx src/features/assistant/use-assistant-turn.test.tsx`

Expected: FAIL because both hooks are missing.

- [ ] **Step 6: Implement timeline and assistant-turn hooks**

`useTimeline(api, workspaceId)` owns `{ events, status, error, refresh }`, polls only while mounted, merges by event ID, and sorts by `(createdAt,id)`. `useAssistantTurn` owns `{ status, turnId, streamedText, error, submit, cancel }`, creates a fresh `crypto.randomUUID()` idempotency key per user submit, consumes frames with `for await`, and invokes injected `onTimelineChanged` and `onContextSelected` callbacks. Prevent simultaneous submits and disable cancel outside `creating|streaming`.

- [ ] **Step 7: Run all web tests**

Run: `corepack pnpm --filter @future/web test`

Expected: API client and hooks pass with all Phase 1 web tests.

- [ ] **Step 8: Commit browser data flow**

```powershell
git add apps/web/src/app apps/web/src/features/timeline/use-timeline* apps/web/src/features/assistant/use-assistant-turn*
git commit -m "feat: connect browser assistant streams"
```

---

### Task 8: Persistent Composer, Real Timeline, Citations, and Context Inspector

**Files:**
- Create: `apps/web/src/features/assistant/AssistantComposer.tsx`
- Test: `apps/web/src/features/assistant/AssistantComposer.test.tsx`
- Modify: `apps/web/src/features/assistant/AssistantResponse.tsx`
- Create: `apps/web/src/features/assistant/ContextInspector.tsx`
- Test: `apps/web/src/features/assistant/ContextInspector.test.tsx`
- Modify: `apps/web/src/features/timeline/TimelineView.tsx`
- Create: `apps/web/src/features/timeline/TimelineView.test.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/src/styles/global.css`
- Modify: `tests/e2e/hero-flow.spec.ts`

**Interfaces:**
- Consumes: live SQLite timeline data, assistant hook state, selected workspace/profile, and immutable context inspections.
- Produces: the complete one-assistant center column and right inspector experience.

- [ ] **Step 1: Write failing component/App tests**

Assert:

- the composer is always visible at the bottom of the ready timeline, has label `Message Future`, submits trimmed text with the active workspace/profile, disables duplicate submits, and swaps Send for Cancel while streaming
- the timeline renders user messages, streaming assistant text, completed assistant responses, and system lifecycle events from typed payloads without fabricated demo content
- citation buttons use source titles and select a response context pack
- the inspector loads the selected immutable pack and displays provider, model, token count, memory/document/event source cards, ranges, and citation ordinals
- App workspace selection changes the timeline lens without creating a new assistant identity
- failed/cancelled states are visible and the composer remains reusable

Rewrite `tests/e2e/hero-flow.spec.ts` at the same red-test stage. Remove `request`
and all direct API calls. Through visible controls only, complete first-run setup,
submit a first question, observe the streaming/Cancel state, wait for persisted
user and assistant events, submit a second question that can cite the first turn,
open its citation in the inspector, reload, and assert both turns return from
SQLite while the composer remains available.

- [ ] **Step 2: Run component tests and verify red**

Run: `corepack pnpm --filter @future/web test -- src/features/assistant src/features/timeline src/app/App.test.tsx`

Expected: FAIL because the ready shell still renders an empty static timeline and placeholder inspector.

Run: `corepack pnpm test:e2e`

Expected: FAIL at the first missing persistent composer/streaming behavior; the
test must not create data through `request`, `fetch`, or direct SQLite access.

- [ ] **Step 3: Implement focused assistant components**

`AssistantComposer` owns only input/keyboard/form behavior; Enter submits and Shift+Enter inserts a newline. `TimelineView` owns only event presentation and selection callbacks. `AssistantResponse` renders response text plus numbered citation buttons from separately supplied `SourceReference[]`. `ContextInspector` owns load/error/empty states for one selected context-pack ID and does not query mutable source endpoints.

- [ ] **Step 4: Connect the ready App shell**

Track active workspace, active profile, and selected context pack in `App`. Feed `useTimeline` into `TimelineView`; feed `useAssistantTurn` into `AssistantComposer`; show `streamedText` as a transient assistant item until SQLite returns the completed assistant event; refresh timeline after every terminal frame; automatically select the completed pack; retain the command palette as a secondary surface. Keep the composer below the scrollable timeline so navigation and inspector changes never unmount it.

- [ ] **Step 5: Add responsive and state styling**

Add explicit styles for `.assistant-workspace`, `.timeline-scroll`, `.assistant-composer`, `.streaming-response`, `.citation-button`, `.context-source-card`, `.turn-error`, and `.turn-cancelled`. At widths below 900px, place the inspector after the timeline while keeping the composer reachable; preserve visible focus and disabled states.

- [ ] **Step 6: Run web tests and production build**

Run: `corepack pnpm --filter @future/web test`

Expected: all App, composer, timeline, inspector, hook, setup, and client tests pass.

Run: `corepack pnpm --filter @future/web build`

Expected: Vite exits 0 and writes the production bundle to `apps/web/dist`.

- [ ] **Step 7: Commit the one-assistant interface**

```powershell
git add apps/web/src tests/e2e/hero-flow.spec.ts
git commit -m "feat: add persistent assistant composer"
```

---

### Task 9: Phase 2 Documentation and Full Verification

**Files:**
- Modify: `docs/context.md`
- Modify: `docs/10-build-runbook.md`
- Modify: `docs/11-release-checklist.md`

**Interfaces:**
- Consumes: completed Phase 2 browser/API flow and exact verification commands.
- Produces: fresh browser proof of the vertical slice and current contributor/release guidance.

- [ ] **Step 1: Update project documentation**

Update `docs/context.md` to mark Phase 2 complete, list the assistant/context/provider/browser boundaries, and name Phase 3 memory management/retrieval refinement as the next boundary. Update the runbook with the two-process local flow, browser composer, V2 turn/create/stream/cancel lifecycle, mock and Ollama streaming, SQLite timeline polling, context inspection, and how failure/cancellation appear. Add Phase 2 gates to the release checklist for idempotency, hybrid source filtering, immutable citations, streaming, cancellation, failure, reload durability, and browser-only Playwright coverage.

- [ ] **Step 2: Run the complete workspace gate**

Run: `corepack pnpm check`

Expected: typecheck, lint, and every unit/integration test pass with exit code 0.

- [ ] **Step 3: Build the production web bundle**

Run: `corepack pnpm --filter @future/web build`

Expected: Vite exits 0 and writes `apps/web/dist`.

- [ ] **Step 4: Run browser verification**

Run: `corepack pnpm test:e2e`

Expected: all Chromium tests pass using only browser interactions for the assistant flow.

- [ ] **Step 5: Run whitespace and repository audits**

Run: `git diff --check`

Expected: exit code 0.

Run: `git status --short --branch`

Expected: only the intended Phase 2 documentation changes remain uncommitted.

- [ ] **Step 6: Commit Phase 2 documentation**

```powershell
git add docs/context.md docs/10-build-runbook.md docs/11-release-checklist.md
git commit -m "docs: document continuous assistant workflow"
```

- [ ] **Step 7: Perform the completion audit**

Re-read the approved V2 design's Phase 2, event-history, continuous-turns, sources/citations, provider runtime, error recovery, testing, and acceptance sections. Map each explicit Phase 2 requirement to a passing unit/integration/browser test or inspected persisted record. Then run:

```powershell
git status --short --branch
git log --oneline --decorate -12
git diff --check HEAD
```

Expected: clean `v2` worktree, one focused commit per task, no merge into `main`, no push, and current evidence for every required gate.
