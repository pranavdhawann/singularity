# Future V2 Phase 4 Imports and External Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver resumable browser imports and an immutable, privacy-gated OpenAI-compatible streaming path through the existing V2 assistant lifecycle.

**Architecture:** Extend the existing SQLite-backed V2 contracts with idempotent import jobs, immutable prompt previews/grants, and one additional assistant-turn state. Keep parsing, privacy transformation, and provider streaming pure at package boundaries; coordinate persistence and SSE behavior in focused API services. Reuse the existing documents, FTS, context packs, citations, timeline, and browser command center.

**Tech Stack:** TypeScript 6.0, Node.js, Fastify 5.9, `@fastify/multipart` 10.1, SQLite/FTS5 with `better-sqlite3`, React 19, Vitest 4, Playwright 1.61.

## Global Constraints

- Extend the Phase 3 event, assistant-turn, source, retrieval, context-pack, provider, and permission contracts; do not create parallel chat or retrieval flows.
- Persist import progress, prompt previews, grants, and terminal outcomes before reporting them to the browser.
- External execution fails closed if final-prompt redaction or immutable-grant verification fails.
- Never persist or log resolved secrets, raw pre-redaction prompts, external response bodies, or imported content in timeline payloads.
- Mock and Ollama flows remain fully offline-capable and do not require prompt-preview approval.
- Each file is independently retryable; completed documents, chunks, FTS rows, and embeddings survive sibling failures.
- Keep desktop packaging, sync, teams, broad connectors, plugins, proactive jobs, and automatic cost routing out of Phase 4.

---

## File Map

- `packages/core/src/imports.ts`: import/job DTOs and V2 API inputs.
- `packages/core/src/prompt-preview.ts`: preview/grant DTOs, binding inputs, and SSE approval frame.
- `packages/core/src/assistant.ts`: add `awaiting_approval` and approval-required stream frame.
- `packages/db/src/migrations/0004-imports-external-models.ts`: Phase 4 persistence and uniqueness.
- `packages/db/src/repositories/import-jobs.ts`: import/job/document checkpoint persistence.
- `packages/db/src/repositories/prompt-previews.ts`: immutable preview and decision persistence.
- `packages/permissions/src/prompt-preview.ts`: whole-prompt redaction and deterministic binding hash.
- `packages/providers/src/openai-compatible.ts`: OpenAI-compatible streaming parser and abort support.
- `apps/api/src/services/import-service.ts`: resumable import/index orchestration.
- `apps/api/src/services/provider-service.ts`: call-time external runtime and `env:` secret resolution.
- `apps/api/src/services/prompt-preview-service.ts`: preview creation and grant verification.
- `apps/api/src/services/assistant-service.ts`: approval pause/resume within the existing turn.
- `apps/api/src/routes/v2/imports.ts`: protected multipart/list/retry resources.
- `apps/api/src/routes/v2/prompt-previews.ts`: protected preview/decision resources.
- `apps/web/src/features/imports/*`: import selection, persisted progress, retry, and source inspection.
- `apps/web/src/features/prompt-preview/*`: exact preview, approval, denial, and stream resume.
- `tests/e2e/phase4.spec.ts`: browser acceptance gate with deterministic external server.

### Task 1: Add Phase 4 contracts and migration

**Files:**
- Create: `packages/core/src/imports.ts`
- Create: `packages/core/src/prompt-preview.ts`
- Modify: `packages/core/src/assistant.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/db/src/migrations/0004-imports-external-models.ts`
- Modify: `packages/db/src/migrations/runner.ts`
- Modify: `packages/db/src/migrations/runner.test.ts`

**Interfaces:**
- Produces: `ImportJobDto`, `PromptPreviewDto`, `PromptDecisionDto`, `PromptBindingInput`, `AssistantTurnState` including `awaiting_approval`, and `AssistantStreamFrame` including `approval_required`.
- Consumes: existing ID, source citation, assistant-turn, provider, and context-pack types.

- [ ] **Step 1: Write failing contract and migration tests**

Add assertions that a migrated database contains `import_job_checkpoints`,
`prompt_previews`, and `prompt_decisions`, that `assistant_turns` accepts
`awaiting_approval`, and that the DTO union accepts this exact frame:

```ts
const frame: AssistantStreamFrame = {
  type: "approval_required",
  turnId: "turn_1",
  previewId: "preview_1"
};
expect(frame.type).toBe("approval_required");
```

Run: `corepack pnpm --filter @future/core test && corepack pnpm --filter @future/db test`
Expected: FAIL because Phase 4 exports and migration tables do not exist.

- [ ] **Step 2: Define exact core contracts**

Implement these stable shapes:

```ts
export type ImportJobState = "queued" | "parsing" | "indexing" | "embedding" | "completed" | "failed";
export interface ImportJobDto {
  id: string; importId: string; workspaceId: string; filename: string;
  mediaType: string; byteSize: number; state: ImportJobState;
  documentIndex: number; nextChunkIndex: number; documentCount: number;
  completedDocumentCount: number; errorCode?: string;
  createdAt: string; updatedAt: string;
}
export interface PromptBindingInput {
  turnId: string; providerId: string; modelProfileId: string; model: string;
  contextPackId: string; contextPackHash: string; promptHash: string;
}
export interface PromptPreviewDto extends PromptBindingInput {
  id: string; workspaceId: string; endpointClassification: "external";
  redactedPrompt: string; estimatedTokens: number;
  privacyLabels: string[]; redactionCounts: Record<string, number>;
  selectedSources: SourceCitation[]; excludedSources: SourceCitation[];
  bindingHash: string; createdAt: string; expiresAt: string;
}
export interface PromptDecisionDto {
  id: string; previewId: string; decision: "approved" | "denied";
  bindingHash: string; decidedAt: string;
}
```

- [ ] **Step 3: Add migration `0004_imports_external_models`**

Create checkpoint, preview, and decision tables; add import metadata/progress
columns; add `content_hash` to chunks; add `prompt_preview_id` and
`prompt_decision_id` to model calls. Use unique indexes on
`(import_id, content_hash)`, `(document_id, chunk_index, content_hash)`, and
`prompt_decisions(preview_id)` so retries and decisions are immutable.

- [ ] **Step 4: Run focused tests and commit**

Run: `corepack pnpm --filter @future/core test && corepack pnpm --filter @future/db test`
Expected: PASS.

```powershell
git add packages/core packages/db
git commit -m "feat: add phase 4 contracts and persistence"
```

### Task 2: Implement immutable prompt construction and binding

**Files:**
- Create: `packages/permissions/src/prompt-preview.ts`
- Create: `packages/permissions/src/prompt-preview.test.ts`
- Modify: `packages/permissions/src/index.ts`
- Modify: `packages/permissions/src/redaction.ts`

**Interfaces:**
- Consumes: `PromptBindingInput`, context-pack items, provider/profile metadata, system instructions, and user text.
- Produces: `buildExternalPromptPreview(input): ExternalPromptPreviewResult` and `hashPromptBinding(input): string`.

- [ ] **Step 1: Write failing privacy-boundary tests**

Cover secrets in every segment, stable hashes for equal inputs, changed hashes
for provider/model/context/prompt changes, counts without raw matches, and a
redaction failure that throws `PromptRedactionError`:

```ts
const result = buildExternalPromptPreview({
  turnId: "turn_1", providerId: "provider_1", modelProfileId: "profile_1",
  model: "test-model", contextPackId: "pack_1", contextPackHash: "pack-hash",
  instructions: "Never expose sk-system-secret123",
  userText: "Email me at user@example.com",
  segments: [{ source: { type: "document", id: "doc_1" }, text: "Bearer abcdefghijk", privacyLabels: ["private"] }]
});
expect(result.redactedPrompt).not.toMatch(/sk-system|user@example|abcdefghijk/);
expect(result.redactionCounts).toEqual({ email: 1, secret: 2 });
```

Run: `corepack pnpm --filter @future/permissions test`
Expected: FAIL because the preview builder is absent.

- [ ] **Step 2: Implement pure final-prompt processing**

Render instructions, labeled context segments, and user text first; call the
redactor once on the whole rendered prompt; calculate counts, estimated tokens,
SHA-256 prompt hash, and SHA-256 binding hash over canonical JSON with sorted
object keys. Catch any redactor failure and throw `PromptRedactionError` without
including source text in the message.

- [ ] **Step 3: Run focused tests and commit**

Run: `corepack pnpm --filter @future/permissions test`
Expected: PASS with no raw sensitive values in snapshots or errors.

```powershell
git add packages/permissions
git commit -m "feat: build immutable redacted prompt previews"
```

### Task 3: Add resumable import repositories and service

**Files:**
- Create: `packages/db/src/repositories/import-jobs.ts`
- Create: `packages/db/src/repositories/import-jobs.test.ts`
- Modify: `packages/db/src/index.ts`
- Create: `apps/api/src/services/import-service.ts`
- Create: `apps/api/src/services/import-service.test.ts`
- Modify: `apps/api/src/server/dependencies.ts`
- Modify: `apps/api/src/server/create-server.ts`

**Interfaces:**
- Produces: `ImportJobRepository.createFile`, `get`, `listForWorkspace`, `advance`, `fail`, `retry`; `ImportService.enqueueFile`, `run`, and `retry`.
- Consumes: pure parsers/chunker, `EventRepository`, `EmbeddingRepository`, SQLite, and the existing retrieval index function.

- [ ] **Step 1: Write failing idempotency and checkpoint tests**

Prove a failure after chunk 1 leaves chunk 0 and its FTS row committed; retry
starts at chunk 1; replay creates no duplicate document, chunk, embedding, or
timeline rows; a malformed sibling does not roll back a valid file.

Run: `corepack pnpm --filter @future/db test -- import-jobs && corepack pnpm --filter @future/api test -- import-service`
Expected: FAIL because repository/service modules do not exist.

- [ ] **Step 2: Implement repository transitions**

Use compare-and-set updates such as:

```sql
UPDATE jobs SET status = @nextState, result_json = @checkpoint, error_message = NULL
WHERE id = @id AND status = @expectedState
```

Return the updated `ImportJobDto`; throw `ImportJobConflictError` if no row is
updated. Store only filename, media type, byte count, content hash, counters,
and safe error codes in job/import metadata.

- [ ] **Step 3: Implement short-transaction orchestration**

Parse outside a write transaction. For each normalized document and chunk, use
stable SHA-256 identities and commit document/chunk/FTS/checkpoint/event together.
On restart, read the checkpoint and skip committed units. Embedding failure moves
the job to `failed` with `embedding_failed` while lexical rows remain usable;
retry resumes embedding only.

- [ ] **Step 4: Run focused tests and commit**

Run: `corepack pnpm --filter @future/db test -- import-jobs && corepack pnpm --filter @future/api test -- import-service`
Expected: PASS.

```powershell
git add packages/db apps/api/src/services apps/api/src/server
git commit -m "feat: add resumable import indexing jobs"
```

### Task 4: Add protected multipart import resources

**Files:**
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/api/src/routes/v2/imports.ts`
- Create: `apps/api/src/routes/v2/imports.test.ts`
- Modify: `apps/api/src/server/create-server.ts`

**Interfaces:**
- Produces: `POST /api/v2/imports`, `GET /api/v2/imports?workspaceId=`, `GET /api/v2/imports/:id`, `POST /api/v2/imports/:id/retry`.
- Consumes: `ImportService` and existing local-session/origin protection.

- [ ] **Step 1: Install and pin multipart support**

Run: `corepack pnpm --filter @future/api add @fastify/multipart@10.1.0`
Expected: `apps/api/package.json` and `pnpm-lock.yaml` change only for the plugin and transitive metadata.

- [ ] **Step 2: Write failing route tests**

Use Fastify injection with multipart bodies. Assert 201 for `.md`, `.txt`, and
ChatGPT `.json`; 415 for other types; 413 above 25 MiB per file or 50 MiB total;
401 without session token; 403 for disallowed origin; partial 207 response when
one file fails validation; list/detail/retry return persisted state.

Run: `corepack pnpm --filter @future/api test -- imports`
Expected: FAIL because V2 routes are unregistered.

- [ ] **Step 3: Implement strict multipart boundary**

Register `@fastify/multipart` with `limits: { fileSize: 26_214_400, files: 10,
parts: 20 }`. Require a `workspaceId` field before files. Infer supported kind
from extension plus media type, buffer one bounded file at a time, enqueue each
file independently, and return safe per-file results. Do not include file content
in validation errors.

- [ ] **Step 4: Run focused tests and commit**

Run: `corepack pnpm --filter @future/api test -- imports`
Expected: PASS.

```powershell
git add apps/api/package.json pnpm-lock.yaml apps/api/src/routes/v2/imports.ts apps/api/src/routes/v2/imports.test.ts apps/api/src/server/create-server.ts
git commit -m "feat: add protected browser import api"
```

### Task 5: Stream OpenAI-compatible text with call-time secrets

**Files:**
- Modify: `packages/providers/src/openai-compatible.ts`
- Create: `packages/providers/src/openai-compatible.test.ts`
- Modify: `apps/api/src/services/provider-service.ts`
- Modify: `apps/api/src/services/provider-service.test.ts`

**Interfaces:**
- Produces: `OpenAiCompatibleProvider` yielding incremental `ModelTextChunk`; `ProviderService.getRuntime` supporting `openai-compatible`.
- Consumes: persisted base URL, model profile, `env:NAME` reference, and abort signal.

- [ ] **Step 1: Write failing provider tests with a local HTTP server**

Assert authorization is resolved at request time, `stream: true` is sent, SSE
`data:` deltas are yielded in order, `[DONE]` terminates, abort closes the request,
and 401/malformed frames throw safe errors that exclude response bodies, prompt,
and secret.

Run: `corepack pnpm --filter @future/providers test && corepack pnpm --filter @future/api test -- provider-service`
Expected: FAIL because the current adapter is non-streaming and runtime rejects external profiles.

- [ ] **Step 2: Implement incremental SSE parsing**

Read `response.body` with `TextDecoder`, retain incomplete lines between chunks,
parse only `data:` lines, ignore blank/comment lines, stop on `[DONE]`, and yield
`choices[0].delta.content` strings. Throw `OpenAiCompatibleProviderError` with
`request_failed`, `stream_unavailable`, or `invalid_stream` only.

- [ ] **Step 3: Resolve external runtime safely**

Require an HTTP(S) base URL and `env:` reference. Resolve `process.env[name]`
inside `getRuntime`; never cache it. Return `missing_external_secret` or
`invalid_external_endpoint` without echoing the value.

- [ ] **Step 4: Run focused tests and commit**

Run: `corepack pnpm --filter @future/providers test && corepack pnpm --filter @future/api test -- provider-service`
Expected: PASS.

```powershell
git add packages/providers apps/api/src/services/provider-service.ts apps/api/src/services/provider-service.test.ts
git commit -m "feat: stream openai compatible model responses"
```

### Task 6: Persist previews and immutable decisions

**Files:**
- Create: `packages/db/src/repositories/prompt-previews.ts`
- Create: `packages/db/src/repositories/prompt-previews.test.ts`
- Modify: `packages/db/src/index.ts`
- Create: `apps/api/src/services/prompt-preview-service.ts`
- Create: `apps/api/src/services/prompt-preview-service.test.ts`
- Create: `apps/api/src/routes/v2/prompt-previews.ts`
- Create: `apps/api/src/routes/v2/prompt-previews.test.ts`
- Modify: `apps/api/src/server/dependencies.ts`
- Modify: `apps/api/src/server/create-server.ts`

**Interfaces:**
- Produces: `PromptPreviewRepository.create/get/decide`, `PromptPreviewService.createForTurn/decide/requireGrant`, protected preview GET and decision POST routes.
- Consumes: Task 2 preview builder and Task 1 binding DTOs.

- [ ] **Step 1: Write failing immutability tests**

Prove preview rows cannot be updated, a second decision conflicts, expired
previews cannot be approved, changed binding inputs invalidate approval, denied
previews never produce a grant, and workspace-scoped reads cannot cross workspaces.

Run: `corepack pnpm --filter @future/db test -- prompt-previews && corepack pnpm --filter @future/api test -- prompt-preview`
Expected: FAIL because repositories and routes do not exist.

- [ ] **Step 2: Implement repository and service**

Insert previews once. Recompute the binding from persisted turn/profile/context
pack/prompt hashes immediately before decision and execution. Insert exactly one
decision under the unique preview constraint. `requireGrant` returns only an
approved, unexpired, exact binding match.

- [ ] **Step 3: Implement protected routes**

Add `GET /api/v2/prompt-previews/:id` and
`POST /api/v2/prompt-previews/:id/decision` with `{ decision: "approved" |
"denied", bindingHash: string }`. Return stable 404, 409, and 410 error envelopes
for missing, mismatched/decided, and expired previews.

- [ ] **Step 4: Run focused tests and commit**

Run: `corepack pnpm --filter @future/db test -- prompt-previews && corepack pnpm --filter @future/api test -- prompt-preview`
Expected: PASS.

```powershell
git add packages/db apps/api/src/services/prompt-preview-service* apps/api/src/routes/v2/prompt-previews* apps/api/src/server
git commit -m "feat: add immutable prompt preview grants"
```

### Task 7: Pause and resume external assistant turns

**Files:**
- Modify: `packages/db/src/repositories/assistant-turns.ts`
- Modify: `packages/db/src/repositories/assistant-turns.test.ts`
- Modify: `apps/api/src/services/assistant-service.ts`
- Modify: `apps/api/src/services/assistant-service.test.ts`
- Modify: `apps/api/src/routes/v2/assistant-turns.ts`
- Modify: `apps/api/src/routes/v2/assistant-turns.test.ts`

**Interfaces:**
- Consumes: `PromptPreviewService`, external/local provider classification, existing context service and cancellation registry.
- Produces: external turns that emit `approval_required`, persist `awaiting_approval`, resume exactly once after approval, and preserve existing local behavior.

- [ ] **Step 1: Write failing lifecycle tests**

Assert an external turn creates context and preview, emits context then
approval-required, and makes no provider call; approval resumes the same turn and
model-call record; denial terminates without a model call; changed binding fails;
cancellation works while awaiting approval; local mock/Ollama tests remain
unchanged; secrets/raw prompts are absent from events and model-call errors.

Run: `corepack pnpm --filter @future/api test -- assistant`
Expected: FAIL because external turns cannot await or resume approval.

- [ ] **Step 2: Split context preparation from model execution**

Refactor `streamTurn` into focused private operations: `prepareTurn`,
`createExternalPreview`, `requireExternalGrant`, `runProvider`, and
`finishTerminal`. Reconnect to an `awaiting_approval` turn only when
`requireGrant` succeeds. Use a compare-and-set transition to `running` before
creating the model call so concurrent streams cannot execute twice.

- [ ] **Step 3: Preserve safe terminal behavior**

Denial writes `prompt_preview.denied` and `assistant.turn.denied`; invalidation
writes a safe failed outcome; cancellation invalidates an undecided preview;
provider failure keeps only safe code and partial-character count. Attach the
preview/decision IDs to the model call after approval.

- [ ] **Step 4: Run API suite and commit**

Run: `corepack pnpm --filter @future/api test`
Expected: PASS, including all existing mock/Ollama streaming and cancellation tests.

```powershell
git add packages/db/src/repositories/assistant-turns* apps/api/src/services/assistant-service* apps/api/src/routes/v2/assistant-turns*
git commit -m "feat: gate external assistant turns on prompt approval"
```

### Task 8: Build the browser Import lens

**Files:**
- Modify: `apps/web/src/app/api-types.ts`
- Modify: `apps/web/src/app/api-client.ts`
- Modify: `apps/web/src/app/api-client.test.ts`
- Create: `apps/web/src/features/imports/ImportWorkspace.tsx`
- Create: `apps/web/src/features/imports/ImportWorkspace.test.tsx`
- Create: `apps/web/src/features/imports/use-imports.ts`
- Create: `apps/web/src/features/imports/use-imports.test.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/styles/global.css`

**Interfaces:**
- Produces: multipart upload, persisted job polling, per-file progress/failure/retry, and document/source-range inspection.
- Consumes: Task 4 V2 resources and active workspace state.

- [ ] **Step 1: Write failing client and component tests**

Assert `FormData` preserves multiple files, session headers omit manual
content-type, progress survives rerender/reload from API state, one file failure
does not hide successes, retry targets only the failed import, and completed
documents expose source range controls.

Run: `corepack pnpm --filter @future/web test -- imports api-client`
Expected: FAIL because import client/UI modules do not exist.

- [ ] **Step 2: Implement typed client and polling hook**

Add `uploadImports(workspaceId, files)`, `listImports(workspaceId)`,
`getImport(id)`, and `retryImport(id)`. Poll while any job is nonterminal and stop
on completion/unmount. Rehydrate exclusively from persisted API state.

- [ ] **Step 3: Implement Import lens**

Accept `.md,.markdown,.txt,.json`; render filename, phase, document/chunk counts,
safe error, and retry. Add keyboard-accessible file input and buttons. Route
completed source selection into the existing context/source inspector rather
than duplicating an inspector.

- [ ] **Step 4: Run web tests/build and commit**

Run: `corepack pnpm --filter @future/web test && corepack pnpm --filter @future/web build`
Expected: PASS.

```powershell
git add apps/web
git commit -m "feat: add browser import and retry workflow"
```

### Task 9: Build exact prompt-preview approval UI

**Files:**
- Modify: `apps/web/src/app/api-types.ts`
- Modify: `apps/web/src/app/api-client.ts`
- Modify: `apps/web/src/features/assistant/use-assistant-turn.ts`
- Modify: `apps/web/src/features/assistant/use-assistant-turn.test.tsx`
- Create: `apps/web/src/features/prompt-preview/ExternalPromptPreview.tsx`
- Create: `apps/web/src/features/prompt-preview/ExternalPromptPreview.test.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/styles/global.css`

**Interfaces:**
- Produces: exact redacted-prompt display, metadata, approve/deny actions, and same-turn SSE reconnect.
- Consumes: Task 6 preview resources and Task 7 approval-required frame.

- [ ] **Step 1: Write failing browser behavior tests**

Assert the UI shows provider, endpoint classification, model, instructions,
selected/excluded sources, privacy labels, token estimate, redaction counts, and
the exact `redactedPrompt`; approval submits the displayed binding hash and
reconnects the same turn; denial does not reconnect; 409/410 require a refreshed
preview and never reuse stale approval.

Run: `corepack pnpm --filter @future/web test -- prompt-preview assistant-turn`
Expected: FAIL because the hook does not recognize approval-required frames.

- [ ] **Step 2: Implement approval state and reconnect**

On `approval_required`, stop the current EventSource/fetch stream cleanly, fetch
the preview, and expose it to the modal/panel. On approval success, reconnect to
`/api/v2/assistant-turns/:turnId/stream`; on denial, refresh timeline and clear
the composer state. Never derive or edit the binding hash in the browser.

- [ ] **Step 3: Run web tests/build and commit**

Run: `corepack pnpm --filter @future/web test && corepack pnpm --filter @future/web build`
Expected: PASS.

```powershell
git add apps/web
git commit -m "feat: add immutable external prompt approval ui"
```

### Task 10: Prove the Phase 4 browser acceptance gate and update docs

**Files:**
- Create: `tests/fixtures/imports/phase4-notes.md`
- Create: `tests/fixtures/imports/chatgpt-export.json`
- Create: `tests/e2e/support/openai-compatible-server.ts`
- Create: `tests/e2e/phase4.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `docs/context.md`
- Modify: `docs/10-build-runbook.md`
- Modify: `docs/12-next-steps.md`
- Modify: `README.md`

**Interfaces:**
- Produces: deterministic end-to-end evidence for every Phase 4 acceptance criterion and current operator docs.
- Consumes: the complete Phase 4 implementation.

- [ ] **Step 1: Write the failing Playwright scenario**

In one fresh browser session: configure the deterministic external profile;
upload Markdown and ChatGPT fixtures; interrupt indexing through a test-only
fault injection; reload and retry; verify no duplicates and retrieve both
sources; submit a prompt containing a test email; inspect exact redaction and
metadata; approve; observe streamed cited answer; inspect source, permission,
model, and redaction records. Add separate offline mock and Ollama configuration
checks.

Run: `corepack pnpm exec playwright test tests/e2e/phase4.spec.ts`
Expected: FAIL at the first missing or incorrectly wired Phase 4 behavior.

- [ ] **Step 2: Close only acceptance-level gaps**

Fix integration defects revealed by the scenario without widening Phase 4 scope.
Keep fault injection behind `FUTURE_TEST_IMPORT_FAILURE_AFTER_CHUNK` and ensure it
is inert when unset. Re-run the single scenario after each fix until green.

- [ ] **Step 3: Update canonical documentation**

Mark Phase 4 complete in README/context/next-steps, document multipart limits,
supported formats, retry semantics, `env:` secrets, prompt approval, local test
server usage, and safe failure troubleshooting. Move the current boundary to
Phase 5 without claiming Phase 5 work.

- [ ] **Step 4: Run full completion gates**

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm --filter @future/web build
corepack pnpm test:e2e
git diff --check
```

Expected: every command exits 0; the browser suite includes the complete Phase 4
flow and existing Phase 1-3 scenarios.

- [ ] **Step 5: Audit secret and content leakage**

Run targeted database assertions and repository searches against test markers:

```powershell
rg -n "sk-system-secret123|user@example.com|abcdefghijk" .future tests/test-output playwright-report
```

Expected: no raw marker in runtime database/log/report artifacts; occurrences in
source test fixtures/assertions are allowed and manually distinguished.

- [ ] **Step 6: Commit the verified Phase 4 checkpoint**

```powershell
git add tests docs README.md playwright.config.ts
git commit -m "test: verify phase 4 browser acceptance flow"
git status --short --branch
```

Expected: clean working tree on the local branch, ahead of its remote only by the
Phase 4 design, plan, and implementation commits; do not push or merge unless the
user explicitly requests it.

