# Future V2 Phase 4: Imports and External Models Design

## Status

Approved on 2026-07-11. This document is the Phase 4 implementation source of
truth beneath the approved V2 product design and `docs/12-next-steps.md`.

## Goal

Complete the real source-ingestion and external-model path without creating a
parallel chat, retrieval, source, or permission system. A browser user must be
able to import Markdown, text, and ChatGPT exports; resume interrupted indexing;
retrieve and inspect imported sources; preview and approve the exact redacted
prompt for an external OpenAI-compatible provider; and receive a streamed,
cited answer through the existing assistant-turn lifecycle.

## Scope

Phase 4 includes:

1. protected browser multipart imports for Markdown, text, and ChatGPT exports;
2. persisted, resumable parsing, document, chunk, FTS, and optional embedding
   work;
3. call-time OpenAI-compatible text runtime resolution from persisted profiles
   and `env:` secret references;
4. whole-prompt classification and redaction after final context assembly;
5. immutable prompt-preview grants bound to the exact outbound request; and
6. browser controls and browser-driven coverage for the complete flow.

Phase 4 excludes desktop packaging, cloud sync, hosted accounts, teams, broad
connectors, plugins, proactive scheduling, autonomous external actions, and
automatic provider-cost routing.

## Design Principles

- Extend the Phase 3 V2 contracts. Imported documents feed the same document
  tables, FTS index, retrieval runs, context packs, citations, and inspectors.
- Persist before executing. Imports, checkpoints, preview records, grants, and
  terminal outcomes survive reloads and process interruption.
- Make retries idempotent. Stable hashes and uniqueness constraints prevent
  duplicate documents, chunks, embeddings, and timeline outcomes.
- Fail closed for external privacy. An external provider is never called unless
  final-prompt redaction succeeds and an exact, unexpired grant matches it.
- Keep audit data safe. Secrets, endpoint response bodies, and raw outbound
  prompts never enter logs or timeline payloads.
- Preserve offline operation. Mock and Ollama turns require no preview grant and
  remain usable when external-provider support is unconfigured.

## Architecture

### Persistence

Migration `0004_imports_external_models` extends the existing schema with:

- import metadata for original filename, media type, byte size, content hash,
  progress counts, and retry state;
- job attempt and checkpoint fields sufficient to resume at the next unfinished
  document or chunk;
- uniqueness constraints for an import's normalized document hash and a
  document's chunk index/hash;
- prompt previews containing immutable metadata, a final redacted prompt, its
  SHA-256 hash, token estimate, privacy labels, redaction counts, excluded
  sources, and creation/expiry timestamps;
- prompt grants containing the preview ID, decision, deciding timestamp, and
  immutable binding hash; and
- model-call references to the matched preview and grant.

The final redacted prompt is stored only in the protected prompt-preview record
because the browser must show the exact outbound text and later prove what was
approved. Raw pre-redaction prompts and resolved secrets are never persisted.
Prompt preview reads are workspace-scoped and protected by the existing local
session and origin checks.

### Import and Index Job State Machine

An import begins with a protected multipart request. The API validates the
workspace, supported media type, per-file size, and aggregate request size before
accepting content. Each file becomes its own import/job pair so one malformed
file does not roll back successful siblings.

Job states are `queued`, `parsing`, `indexing`, `embedding`, `completed`, and
`failed`. A persisted checkpoint records the normalized-document index and next
chunk index. Each successful unit is committed in a short transaction together
with its checkpoint. Retrying a failed job resumes from that checkpoint.

Document identity is derived from workspace, import, normalized source URI, and
content hash. Chunk identity is derived from document identity, chunk index,
source range, and text hash. Replaying a completed unit is therefore a no-op.
FTS synchronization occurs in the same transaction as chunk persistence.
Embedding generation is optional: an unavailable or failed adapter records a
safe diagnostic and leaves lexical retrieval usable. A user may retry embedding
work without reparsing the source.

Timeline events are emitted once per durable state transition. They contain IDs,
counts, safe error codes, and filenames, never imported content. Existing
completed documents and chunks remain visible if a later document fails.

### Import API and Browser Flow

The V2 API adds protected resources to:

- create one or more multipart imports;
- list imports/jobs for a workspace;
- inspect an import and its completed documents/source ranges;
- retry a failed import job; and
- run or resume queued work.

The browser Import lens accepts `.md`, `.markdown`, `.txt`, and ChatGPT `.json`
files. It displays per-file upload, parsing, indexing, embedding, completed, and
failed states. Failed files expose a retry action and safe diagnostic. Completed
documents open in the existing source/context inspector with normalized ranges.
The browser polls persisted job state, so reloading does not lose progress.

### OpenAI-Compatible Runtime

`ProviderService` resolves the persisted provider and model profile at call time.
For `openai-compatible` providers, the base URL must be an explicit HTTP(S) URL
and the secret reference must use `env:NAME`. The environment variable is read
only immediately before the request. Missing or invalid configuration produces a
safe provider error before network execution.

The provider uses the OpenAI-compatible chat-completions streaming protocol. It
parses server-sent `data:` frames, yields incremental text through the existing
assistant-turn SSE stream, recognizes `[DONE]`, and propagates the turn abort
signal to `fetch`. Non-success statuses and malformed streams become stable safe
error codes; response bodies are not logged or persisted.

A deterministic local HTTP test server exercises streaming, cancellation,
authorization headers, safe failures, and absence of secret/prompt leakage. Real
external endpoints are optional manual verification and are not required by CI.

### Whole-Prompt Privacy Boundary

Prompt construction becomes an explicit pure pipeline:

1. assemble instructions, user text, selected document/memory/event/compaction
   context, and source annotations;
2. classify every segment with its source type, source ID, and privacy labels;
3. render the complete prompt;
4. redact the rendered prompt;
5. verify that redaction completed successfully;
6. calculate redaction counts, exclusions, token estimate, and final SHA-256;
7. create the immutable preview; and
8. either execute locally or wait for an external grant.

Redaction covers secrets, bearer credentials, private keys, email addresses,
phone numbers, and credential paths across all segments, including system text
and the current user message. A redaction exception or invariant failure blocks
external execution. Persisted context-pack items remain immutable; the preview
records which items were included or excluded and the safe counts by redaction
kind.

### Immutable Preview and Grant Lifecycle

Local providers continue directly after context creation. An external provider
changes the turn from context building to `awaiting_approval`. The service creates
one immutable preview containing:

- turn, workspace, provider, endpoint classification, profile, and model;
- instructions and the exact final redacted prompt;
- context-pack ID/hash and selected source metadata;
- privacy labels, exclusions, estimated tokens, and redaction counts; and
- a binding hash covering every execution-relevant field.

The browser receives an SSE `approval_required` frame and opens the Prompt
Preview. Approval or denial is submitted to a protected V2 endpoint. The API
recomputes the binding from persisted records. Approval succeeds only when the
turn, provider, model, context pack, redacted prompt, and binding hash still
match. Any changed input invalidates the preview and requires a new one.

Approval creates an immutable grant and resumes the same turn. Denial creates an
immutable denial and terminates the turn without a model call. Retrying a denied,
expired, or invalidated request creates a new turn/preview rather than mutating
the prior decision. Timeline records contain preview/grant IDs, hashes, safe
counts, and outcomes, not raw prompt text.

### Assistant Turn and SSE Changes

The assistant-turn state model adds `awaiting_approval`. Creating context and a
preview remains idempotent. Streaming a queued local turn behaves as today.
Streaming an external turn without a grant yields context and approval-required
frames, then closes cleanly while the persisted turn waits. After approval, the
browser reconnects to the same turn stream; the server verifies the grant and
runs the provider exactly once.

Cancellation is valid while queued, building context, awaiting approval, or
running. Cancellation while awaiting approval invalidates any undecided preview.
Completion, failure, denial, and cancellation remain terminal persisted outcomes.

## Components and Boundaries

- `packages/core`: Phase 4 DTOs, job/turn states, preview/grant bindings, and SSE
  frames. No database or network dependencies.
- `packages/db`: migration and focused import-job, document, prompt-preview, and
  prompt-grant repositories. Repositories enforce idempotency and immutability.
- `packages/importers`: pure parsing and normalized-document validation. It does
  not write the database or emit events.
- `packages/permissions`: pure prompt segmentation, classification, redaction,
  preview construction, and binding hashing.
- `packages/providers`: streaming OpenAI-compatible adapter. It knows no database
  or permission policy.
- `apps/api`: multipart boundary, persisted job orchestration, runtime resolution,
  grant enforcement, assistant-turn coordination, and safe API errors.
- `apps/web`: import/job UI, prompt preview/decision UI, reconnect behavior, and
  source inspection using the typed V2 client.

## Error Handling and Recovery

API failures use the existing stable error envelope. New safe codes distinguish
unsupported files, upload limits, invalid ChatGPT exports, failed parsing, failed
indexing, missing external secrets, invalid provider endpoints, preview required,
preview expired, preview invalidated, grant denied, and provider stream failure.

Imported content, prompts, secrets, and external response bodies never appear in
error messages. Job failures retain their last completed checkpoint. Retry is
explicit, bounded to failed work, and idempotent. Provider failure preserves the
existing failed assistant-turn behavior and safe partial-character count.

## Testing Strategy

Every implementation slice follows red-green-refactor testing.

- Pure unit tests cover multipart classification helpers, ChatGPT validation,
  stable document/chunk identity, checkpoint advancement, full-prompt redaction,
  binding hashes, and provider stream parsing.
- Repository tests cover migration, uniqueness, resumability, immutable previews,
  immutable decisions, and grant lookup.
- API/service tests cover protected multipart routes, partial file failure,
  checkpoint retry, external runtime resolution, approval/denial/invalidation,
  streaming, cancellation, and safe persistence.
- Web component tests cover file selection, progress, retry, exact preview
  display, approval, denial, and reload restoration.
- Playwright covers the acceptance flow in a fresh browser session using a real
  Markdown file, a real ChatGPT export fixture, an interrupted/resumed job, a
  deterministic local OpenAI-compatible stream, citations, and immutable audit
  inspection. It also proves mock and Ollama setup remain offline-capable.

## Acceptance Criteria

Phase 4 is complete only when all of the following are demonstrated:

1. A fresh browser session imports Markdown/text and a ChatGPT export through
   protected multipart requests.
2. A deliberately interrupted index job resumes without duplicate documents,
   chunks, embeddings, FTS rows, or timeline events.
3. Imported sources are retrievable and their exact source ranges are inspectable.
4. A persisted OpenAI-compatible profile resolves its `env:` secret at call time
   and streams through the existing assistant-turn SSE lifecycle.
5. The entire outbound prompt is classified and redacted after retrieval; any
   redaction failure blocks external execution.
6. The browser shows the exact redacted prompt and all required metadata before
   external execution.
7. Approval is immutable and bound to the turn, provider, model, context pack,
   and final prompt; changed input invalidates it.
8. Denial, retry, cancellation, provider failure, and success are auditable safe
   timeline outcomes.
9. Secrets, raw outbound prompts, imported content, and endpoint response bodies
   are absent from logs and timeline payloads.
10. Mock and Ollama flows remain fully offline-capable.
11. The frozen install, workspace checks, web build, browser suite, and whitespace
    checks all pass:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm --filter @future/web build
corepack pnpm test:e2e
git diff --check
```

