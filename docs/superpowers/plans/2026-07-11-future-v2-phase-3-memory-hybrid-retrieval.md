# Future V2 Phase 3 Memory and Hybrid Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver complete Phase 3 memory management and hybrid retrieval through the existing continuous-assistant flow, including full FTS, optional embeddings, namespaces, revisions, compaction, browser management, and verified retrieval changes.

**Architecture:** Add forward-only SQLite schema and focused repositories, then expose memory behavior through a transactional service and protected V2 routes. Replace ad hoc context loading with a pure hybrid retrieval pipeline whose optional embedding adapters degrade to lexical search, and connect the browser to those same resources without creating a parallel assistant path.

**Tech Stack:** TypeScript 6, SQLite/FTS5 with better-sqlite3, Fastify 5, React 19, Vitest, Testing Library, Playwright, Ollama/OpenAI-compatible HTTP APIs.

---

## File map

- `packages/core/src/memory.ts`: memory, namespace, revision, compaction, and mutation DTOs.
- `packages/core/src/context-packs.ts`: retrieval explanations and fallback metadata on immutable items.
- `packages/db/src/migrations/0003-memory-hybrid-retrieval.ts`: forward-only Phase 3 schema and FTS synchronization.
- `packages/db/src/repositories/memories.ts`: transactional memory state, revisions, and cursored reads.
- `packages/db/src/repositories/namespaces.ts`: shallow hierarchy and memberships.
- `packages/db/src/repositories/compactions.ts`: source-linked compactions and invalidation.
- `packages/db/src/repositories/search.ts`: workspace-scoped FTS across all source kinds.
- `packages/db/src/repositories/embeddings.ts`: content-hash-keyed vectors and invalidation.
- `packages/retrieval/src/embeddings.ts`: adapter contract plus noop implementation.
- `packages/retrieval/src/ollama-embeddings.ts`: local Ollama embeddings adapter.
- `packages/retrieval/src/openai-embeddings.ts`: OpenAI-compatible embeddings adapter.
- `packages/retrieval/src/hybrid.ts`: score normalization, fusion, authorization, diversity, and compaction suppression.
- `packages/retrieval/src/context-pack.ts`: deterministic budgeting and overlap deduplication.
- `apps/api/src/services/memory-service.ts`: memory application workflow and timeline events.
- `apps/api/src/services/context-service.ts`: existing-turn hybrid retrieval orchestration.
- `apps/api/src/routes/v2/memories.ts`: protected memory/revision mutations and reads.
- `apps/api/src/routes/v2/namespaces.ts`: protected namespace resources.
- `apps/api/src/routes/v2/search.ts`: inspectable retrieval endpoint.
- `apps/web/src/features/memory/*`: memory browser, inspector, edit/review controls, namespace navigation.
- `apps/web/src/features/assistant/ContextInspector.tsx`: ranking, fallback, and compaction provenance.
- `tests/e2e/hero-flow.spec.ts`: browser-only Phase 3 behavior.

### Task 1: Define Phase 3 domain contracts

**Files:**
- Modify: `packages/core/src/memory.ts`
- Modify: `packages/core/src/context-packs.ts`
- Modify: `packages/core/src/api.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/memory.test.ts`
- Test: `packages/core/src/api.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add tests that construct a `MemoryDto` with `version`, `namespaceIds`, `primaryNamespaceId`, provenance, and timestamps; a `MemoryRevisionDto`; a shallow `MemoryNamespaceDto`; a source-linked `MemoryCompactionDto`; and a `ContextPackInspection` item with `retrieval.lexicalScore`, `vectorScore`, `finalScore`, and `reasons`. Assert `apiError("conflict", ...)` preserves `expectedVersion` details.

```ts
expect(memory).toMatchObject({ reviewState: "approved", version: 2, namespaceIds: ["ns_code"] });
expect(pack.items[0]?.retrieval).toEqual({
  lexicalScore: 0.8,
  vectorScore: 0.6,
  finalScore: 0.74,
  reasons: ["lexical", "pinned"]
});
```

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @future/core test -- memory.test.ts api.test.ts`

Expected: FAIL because Phase 3 DTOs and retrieval metadata do not exist.

- [ ] **Step 3: Add minimal contracts**

Define `MemoryStatus`, `MemoryDto`, `MemoryRevisionDto`, `MemoryNamespaceDto`, `MemoryCompactionDto`, `MemoryListInput`, `MemoryMutationInput`, `CreateNamespaceInput`, `CreateCompactionInput`, `RetrievalBreakdown`, and additive inspection metadata. Keep dates serialized as strings at API boundaries and export every contract from `packages/core/src/index.ts`.

- [ ] **Step 4: Verify GREEN and commit**

Run: `corepack pnpm --filter @future/core test -- memory.test.ts api.test.ts`

Expected: PASS.

Commit: `git commit -am "feat(core): define phase 3 memory contracts"`

### Task 2: Add the forward-only Phase 3 migration

**Files:**
- Create: `packages/db/src/migrations/0003-memory-hybrid-retrieval.ts`
- Modify: `packages/db/src/migrations/runner.ts`
- Test: `packages/db/src/migrations/runner.test.ts`

- [ ] **Step 1: Write failing clean-start and upgrade tests**

Assert migration order ends in `0003_memory_hybrid_retrieval`; new tables include `memory_namespaces`, `memory_namespace_memberships`, `memory_compaction_sources`, and `source_embeddings`; FTS tables include `memories_fts` and `events_fts`; a Phase 2 turn/context pack/citation survives upgrade; and rerunning records one migration row.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @future/db test -- runner.test.ts`

Expected: FAIL with the missing migration/tables.

- [ ] **Step 3: Implement migration `0003_memory_hybrid_retrieval`**

Create the namespace/membership/compaction-source/embedding tables, add `version`, `deleted_at`, `invalidated_at`, and `content_hash` columns where required, build FTS5 tables, backfill approved memory/event text, and install insert/update/delete triggers. Hash the exact ordered statements and append the migration to `migrations`.

The embedding uniqueness key must be `(source_kind, source_id, content_hash, adapter, model)`. Namespace depth is enforced by repository logic because SQLite cannot express the parent-depth invariant safely in a check constraint.

- [ ] **Step 4: Verify GREEN and commit**

Run: `corepack pnpm --filter @future/db test -- runner.test.ts`

Expected: PASS with three ordered migrations and preserved Phase 2 fixtures.

Commit: `git add packages/db/src/migrations && git commit -m "feat(db): migrate phase 3 memory retrieval schema"`

### Task 3: Implement namespace and memory repositories

**Files:**
- Create: `packages/db/src/repositories/namespaces.ts`
- Create: `packages/db/src/repositories/memories.ts`
- Modify: `packages/db/src/index.ts`
- Test: `packages/db/src/repositories/namespaces.test.ts`
- Test: `packages/db/src/repositories/memories.test.ts`

- [ ] **Step 1: Write failing repository tests**

Cover root/child creation, duplicate sibling names, rejected grandchild/cross-workspace parent, primary plus secondary memberships, status and namespace filters, stable `(updated_at,id)` cursor ordering, optimistic `expectedVersion`, immutable before/after revisions, pin/outdate/delete state, hidden tombstones, and rollback when the mutation event callback throws.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @future/db test -- namespaces.test.ts memories.test.ts`

Expected: FAIL because repositories are missing.

- [ ] **Step 3: Implement focused repositories**

Expose `NamespaceRepository.create/list/get` and `MemoryRepository.create/get/list/mutate/listRevisions`. `mutate` must run one database transaction, compare `expectedVersion`, insert `memory_revisions`, update namespace memberships and FTS-visible state, and invoke an `appendEvent` callback before commit.

```ts
memories.mutate(id, {
  expectedVersion: 1,
  statement: "Use SQLite for local state",
  reviewState: "approved",
  pinned: true,
  namespaceIds: ["ns_repo"],
  primaryNamespaceId: "ns_repo",
  reason: "user_edit"
}, appendEvent);
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `corepack pnpm --filter @future/db test -- namespaces.test.ts memories.test.ts`

Expected: PASS.

Commit: `git add packages/db/src/repositories packages/db/src/index.ts && git commit -m "feat(db): persist memory namespaces and revisions"`

### Task 4: Add compaction and embedding persistence

**Files:**
- Create: `packages/db/src/repositories/compactions.ts`
- Create: `packages/db/src/repositories/embeddings.ts`
- Modify: `packages/db/src/index.ts`
- Test: `packages/db/src/repositories/compactions.test.ts`
- Test: `packages/db/src/repositories/embeddings.test.ts`

- [ ] **Step 1: Write failing tests**

Prove compactions reject empty, missing, or cross-workspace inputs; preserve ordered source references and content hashes; suppress only active inputs; invalidate when an input memory changes/deletes; and vectors round-trip, isolate workspace/source/model, reject dimension mismatch, and disappear after content-hash invalidation.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @future/db test -- compactions.test.ts embeddings.test.ts`

Expected: FAIL because repositories are missing.

- [ ] **Step 3: Implement repositories**

Store vectors as validated JSON number arrays and dimensions as an integer. `CompactionRepository.create` inserts the summary and ordered sources transactionally; `invalidateForSource` sets `invalidated_at`; `EmbeddingRepository.upsert/listForSources/invalidateSource` keys all reads by workspace and current content hash.

- [ ] **Step 4: Verify GREEN and commit**

Run: `corepack pnpm --filter @future/db test -- compactions.test.ts embeddings.test.ts`

Expected: PASS.

Commit: `git add packages/db/src/repositories packages/db/src/index.ts && git commit -m "feat(db): persist compactions and embeddings"`

### Task 5: Replace document-only lexical search with unified FTS

**Files:**
- Create: `packages/db/src/repositories/search.ts`
- Modify: `packages/retrieval/src/lexical.ts`
- Test: `packages/db/src/repositories/search.test.ts`
- Test: `packages/retrieval/src/lexical.test.ts`

- [ ] **Step 1: Write failing search tests**

Index matching document, memory, and prior-event fixtures plus wrong-workspace, proposed, outdated, and deleted memories. Assert only authorized active records return, source references and complete source text are preserved, punctuation-only queries return empty, and ties are stable by source kind/ID.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @future/db test -- search.test.ts; corepack pnpm --filter @future/retrieval test -- lexical.test.ts`

Expected: FAIL because current search returns document chunks only.

- [ ] **Step 3: Implement unified lexical search**

Return a normalized `RetrievalCandidate` for each source kind. Convert negative FTS `bm25` values to a positive normalized score within each result set, keep exact content separate from snippets, and always apply workspace/state filters in SQL.

- [ ] **Step 4: Verify GREEN and commit**

Run the commands from Step 2.

Expected: PASS.

Commit: `git add packages/db/src/repositories/search* packages/retrieval/src/lexical* && git commit -m "feat(retrieval): search events memories and documents"`

### Task 6: Implement optional embedding adapters

**Files:**
- Create: `packages/retrieval/src/embeddings.ts`
- Create: `packages/retrieval/src/ollama-embeddings.ts`
- Create: `packages/retrieval/src/openai-embeddings.ts`
- Modify: `packages/retrieval/src/index.ts`
- Test: `packages/retrieval/src/embeddings.test.ts`
- Test: `packages/retrieval/src/ollama-embeddings.test.ts`
- Test: `packages/retrieval/src/openai-embeddings.test.ts`

- [ ] **Step 1: Write failing adapter contract tests**

Test noop returns `{ available:false, vectors:[] }`; Ollama posts `{model,input}` to `/api/embed`; OpenAI-compatible posts `{model,input}` to `/embeddings` with a bearer key resolved at call time; both validate count, finite numbers, and consistent dimensions; abort propagates; HTTP/body errors become safe typed adapter failures that exclude response bodies and secret values.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @future/retrieval test -- embeddings.test.ts ollama-embeddings.test.ts openai-embeddings.test.ts`

Expected: FAIL because adapters are missing.

- [ ] **Step 3: Implement the adapter contract**

```ts
export interface EmbeddingAdapter {
  readonly id: "noop" | "ollama" | "openai-compatible";
  embed(input: { model: string; texts: readonly string[]; signal?: AbortSignal }): Promise<EmbeddingResult>;
}
```

Use injected `fetch` and injected secret resolver. Never store or return request headers. Normalize both APIs into ordered `number[][]`.

- [ ] **Step 4: Verify GREEN and commit**

Run the command from Step 2.

Expected: PASS.

Commit: `git add packages/retrieval/src && git commit -m "feat(retrieval): add optional embedding adapters"`

### Task 7: Implement deterministic hybrid ranking and context budgeting

**Files:**
- Create: `packages/retrieval/src/hybrid.ts`
- Create: `packages/retrieval/src/hybrid.test.ts`
- Modify: `packages/retrieval/src/context-pack.ts`
- Modify: `packages/retrieval/src/context-pack.test.ts`
- Modify: `packages/retrieval/src/index.ts`

- [ ] **Step 1: Write failing pure tests**

Prove lexical-only ranking; cosine vector ranking; weighted fusion; boosts for pinned, confidence, direct sources, and recency; workspace authorization before scoring; per-kind diversity; identical-hash and overlapping-range dedupe; active-compaction suppression; invalidated-compaction exclusion; stable tie-breaking; reserved prompt/output tokens; and oversize-item skipping.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @future/retrieval test -- hybrid.test.ts context-pack.test.ts`

Expected: FAIL because current builder only sorts ad hoc scores and deduplicates exact source IDs.

- [ ] **Step 3: Implement minimal ranking pipeline**

Normalize each channel to `[0,1]`, fuse available channels without penalizing lexical-only mode, attach explicit reasons, select at least one high-scoring candidate per available kind before filling remaining slots, and reserve caller-specified instruction/user/output budgets. Use source key as the final comparator.

- [ ] **Step 4: Verify GREEN and commit**

Run the command from Step 2.

Expected: PASS with deterministic snapshots.

Commit: `git add packages/retrieval/src && git commit -m "feat(retrieval): rank hybrid context deterministically"`

### Task 8: Add transactional MemoryService

**Files:**
- Create: `apps/api/src/services/memory-service.ts`
- Create: `apps/api/src/services/memory-service.test.ts`
- Modify: `apps/api/src/server/dependencies.ts`
- Modify: `apps/api/src/server/create-server.ts`

- [ ] **Step 1: Write failing service tests**

Test review/edit/pin/outdate/delete/namespace assignment and compaction create the exact `memory.approved`, `memory.revised`, `memory.pinned`, `memory.outdated`, `memory.deleted`, `memory.namespace.assigned`, and `memory.compacted` events in the same transaction. Assert edit/delete invalidates embeddings and dependent compactions; stale versions return a typed conflict.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @future/api test -- memory-service.test.ts`

Expected: FAIL because the service is missing.

- [ ] **Step 3: Implement MemoryService and wire dependencies**

Keep state rules pure in `@future/memory`; orchestration chooses event types and calls repositories. Map repository not-found/conflict/state errors into stable service codes without leaking SQL.

- [ ] **Step 4: Verify GREEN and commit**

Run the command from Step 2.

Expected: PASS.

Commit: `git add apps/api/src/services apps/api/src/server && git commit -m "feat(api): orchestrate memory lifecycle"`

### Task 9: Integrate hybrid retrieval into existing assistant turns

**Files:**
- Modify: `apps/api/src/services/context-service.ts`
- Modify: `apps/api/src/services/context-service.test.ts`
- Modify: `apps/api/src/services/assistant-service.test.ts`
- Modify: `packages/db/src/repositories/context-packs.ts`
- Modify: `packages/db/src/repositories/context-packs.test.ts`

- [ ] **Step 1: Write failing integration tests**

Build turns against all three source kinds and assert immutable packs contain ranking explanations and exact citations. Prove optional embeddings change ordering when available, lexical fallback completes a turn with safe fallback metadata when adapters fail, pinned/outdated/deleted/revised memories change later packs, compactions suppress represented inputs, and an earlier persisted pack never changes.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @future/api test -- context-service.test.ts assistant-service.test.ts; corepack pnpm --filter @future/db test -- context-packs.test.ts`

Expected: FAIL against the current ad hoc loaders.

- [ ] **Step 3: Replace ContextService internals**

Inject search, embeddings, compactions, and adapter resolver; run unified lexical retrieval first; request/query vectors only when configured; call pure `rankHybridCandidates` and the budgeted builder; persist retrieval channel/fallback/reason metadata with the existing context pack before model execution. Do not change `AssistantService` into another turn path.

- [ ] **Step 4: Verify GREEN and commit**

Run the commands from Step 2.

Expected: PASS, including Phase 2 streaming/cancellation/failure tests.

Commit: `git add apps/api/src/services packages/db/src/repositories/context-packs* && git commit -m "feat(api): build hybrid context for assistant turns"`

### Task 10: Expose protected V2 memory, namespace, and search APIs

**Files:**
- Create: `apps/api/src/routes/v2/memories.ts`
- Create: `apps/api/src/routes/v2/memories.test.ts`
- Create: `apps/api/src/routes/v2/namespaces.ts`
- Create: `apps/api/src/routes/v2/namespaces.test.ts`
- Create: `apps/api/src/routes/v2/search.ts`
- Create: `apps/api/src/routes/v2/search.test.ts`
- Modify: `apps/api/src/server/create-server.ts`

- [ ] **Step 1: Write failing route tests**

Cover protected POST/PATCH/DELETE mutations, GET list/detail/revisions, namespace list/create, compaction create, and retrieval search. Assert missing token/wrong origin rejection, `additionalProperties:false`, workspace isolation, stable cursors, 404s, optimistic 409s with version details, and safe adapter fallback metadata.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @future/api test -- memories.test.ts namespaces.test.ts search.test.ts`

Expected: FAIL with route-not-found responses.

- [ ] **Step 3: Implement routes and strict schemas**

Use `GET /api/v2/memories`, `GET /api/v2/memories/:id`, `GET /api/v2/memories/:id/revisions`, `POST /api/v2/memories`, `PATCH /api/v2/memories/:id`, `DELETE /api/v2/memories/:id`, `POST /api/v2/memory-compactions`, `GET|POST /api/v2/namespaces`, and `GET /api/v2/search`. Extend `ApiClient.mutate` to accept method `POST|PATCH|DELETE` in the later browser task.

- [ ] **Step 4: Verify GREEN and commit**

Run the command from Step 2.

Expected: PASS.

Commit: `git add apps/api/src/routes/v2 apps/api/src/server/create-server.ts && git commit -m "feat(api): expose phase 3 memory resources"`

### Task 11: Build the browser memory management experience

**Files:**
- Modify: `apps/web/src/app/api-types.ts`
- Modify: `apps/web/src/app/api-client.ts`
- Modify: `apps/web/src/app/api-client.test.ts`
- Modify: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/features/memory/use-memories.ts`
- Create: `apps/web/src/features/memory/use-memories.test.tsx`
- Create: `apps/web/src/features/memory/MemoryWorkspace.tsx`
- Create: `apps/web/src/features/memory/MemoryWorkspace.test.tsx`
- Create: `apps/web/src/features/memory/MemoryInspector.tsx`
- Create: `apps/web/src/features/memory/MemoryInspector.test.tsx`
- Modify: `apps/web/src/styles/global.css`

- [ ] **Step 1: Write failing client and React tests**

Test status/namespace filters, review count, namespace navigation, detail/provenance display, edit creating a revision, pin/outdate actions, destructive confirmation before delete, conflict refresh, revision history, workspace switching, and accessible loading/error/empty states. Client tests assert PATCH/DELETE use the protected session and encoded paths.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @future/web test -- api-client.test.ts MemoryWorkspace.test.tsx MemoryInspector.test.tsx use-memories.test.tsx`

Expected: FAIL because the API surface and connected views are absent.

- [ ] **Step 3: Implement the connected memory lens**

Make left-rail buttons select `timeline` or `memory`; render namespace counts below Memory; keep the composer/timeline path intact; use controlled forms and native confirmation UI; refresh list/detail after successful mutations; display revisions newest-first. Add responsive styles without replacing the established shell.

- [ ] **Step 4: Verify GREEN and commit**

Run the command from Step 2.

Expected: PASS with no React act warnings.

Commit: `git add apps/web/src && git commit -m "feat(web): manage memory namespaces and revisions"`

### Task 12: Expose hybrid retrieval explanations in the inspector

**Files:**
- Modify: `apps/web/src/features/assistant/ContextInspector.tsx`
- Modify: `apps/web/src/features/assistant/ContextInspector.test.tsx`
- Modify: `apps/web/src/styles/global.css`

- [ ] **Step 1: Write failing inspector tests**

Assert source cards display final score, lexical/vector contribution when present, ranking reasons, compaction provenance, and a visible “Lexical retrieval only” fallback without rendering secret or raw provider-error text.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm --filter @future/web test -- ContextInspector.test.tsx`

Expected: FAIL because ranking metadata is not rendered.

- [ ] **Step 3: Render additive inspection details**

Keep exact source text and model/token/redaction information. Add accessible `<dl>` metadata and a non-error fallback notice driven only by persisted safe metadata.

- [ ] **Step 4: Verify GREEN and commit**

Run the command from Step 2.

Expected: PASS.

Commit: `git add apps/web/src/features/assistant apps/web/src/styles/global.css && git commit -m "feat(web): explain hybrid context ranking"`

### Task 13: Add browser-only Phase 3 acceptance coverage

**Files:**
- Modify: `tests/e2e/hero-flow.spec.ts`
- Modify: `tests/e2e/fixtures/hero.md` only if the visible import-independent fixture text must remain aligned

- [ ] **Step 1: Write the failing browser scenario**

Through visible controls only: complete first run, open Memory, create/review a sourced memory, create and assign a namespace, edit and pin it, inspect its revision, ask a matching question, inspect the cited memory and ranking reason, mark it outdated and verify it disappears from the next answer, restore/correct it, delete with confirmation, and verify it remains absent after reload. Do not use Playwright request APIs or direct database access.

- [ ] **Step 2: Verify RED**

Run: `corepack pnpm test:e2e -- --grep "memory retrieval lifecycle"`

Expected: FAIL at the first missing Memory control.

- [ ] **Step 3: Complete only the integration fixes exposed by the scenario**

For every defect, first add the narrowest failing unit/integration regression test, verify RED, patch minimally, and rerun that test before rerunning Playwright.

- [ ] **Step 4: Verify GREEN and commit**

Run: `corepack pnpm test:e2e -- --grep "memory retrieval lifecycle"`

Expected: PASS entirely through browser controls.

Commit: `git add tests/e2e apps packages && git commit -m "test(e2e): prove phase 3 memory retrieval lifecycle"`

### Task 14: Update operational documentation and perform the completion audit

**Files:**
- Modify: `docs/context.md`
- Modify: `docs/10-build-runbook.md`
- Modify: `docs/11-release-checklist.md`
- Modify: `README.md` only if its phase/status links need updating

- [ ] **Step 1: Update documentation against shipped behavior**

Mark Phase 3 complete; document namespace/revision/compaction resources, unified FTS, adapter configuration and secret handling, lexical fallback, browser memory flow, migration `0003`, and exact targeted/full verification commands. Add requirement-level Phase 3 release gates matching the approved design.

- [ ] **Step 2: Run targeted package gates**

Run:

```powershell
corepack pnpm --filter @future/core test
corepack pnpm --filter @future/db test
corepack pnpm --filter @future/retrieval test
corepack pnpm --filter @future/api test
corepack pnpm --filter @future/web test
```

Expected: every package passes with no warnings or unhandled errors.

- [ ] **Step 3: Run the canonical clean verification workflow**

Run:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm --filter @future/web build
corepack pnpm test:e2e
git diff --check
git status --short
```

Expected: install, typecheck, lint, all unit/integration tests, production build, and all browser flows pass; diff check emits nothing; status contains only intended documentation changes before the final commit.

- [ ] **Step 4: Audit every approved requirement against evidence**

Create a requirement checklist from the design’s Scope and Testing sections and map each item to schema/repository/service/route/UI code plus the exact passing test. Treat any missing or indirect evidence as incomplete and return to RED-GREEN before proceeding.

- [ ] **Step 5: Commit final documentation**

Commit: `git add README.md docs/context.md docs/10-build-runbook.md docs/11-release-checklist.md && git commit -m "docs: complete phase 3 runbook and gates"`

