# Build Runbook

This runbook covers the local Singularity MVP implementation.

## Prerequisites

- Node.js 24 or newer.
- Corepack enabled.
- Network access for the first dependency install.
- Playwright Chromium installed with `corepack pnpm exec playwright install chromium`.

## Install

```powershell
corepack pnpm install --frozen-lockfile
```

The repository pins `pnpm@11.9.0` through `packageManager`. Build scripts for
`better-sqlite3` and `esbuild` are approved in `pnpm-workspace.yaml`.

## Run Locally

For the deterministic offline demo, which uses `.future/demo.sqlite`, the mock
provider, and `examples/singularity-demo.md`:

```powershell
corepack pnpm demo
```

The launcher checks for Node.js 24+ and Corepack before starting. To discard only
the seeded demo database and run the normal seed flow again:

```powershell
corepack pnpm demo --reset
```

The reset removes `.future/demo.sqlite` and its SQLite sidecars only. It does not
remove `.future/future.sqlite` or other local application data.

Open `http://127.0.0.1:4173` and ask `launch readiness decision`.

For an unseeded development database, start API and web together:

```powershell
corepack pnpm dev
```

Default local URLs:

- Web: `http://127.0.0.1:4173`
- API: `http://127.0.0.1:4174`
- API health: `http://127.0.0.1:4174/api/health`

The API stores local data at `.future/future.sqlite` unless `FUTURE_DB_PATH` is
set.

On a new V2 database, the browser opens a first-run form that creates a workspace,
provider, and model profile. The mock provider proves the setup without network
access. Ollama defaults to `http://127.0.0.1:11434` and accepts a user-selected
model name.

V2 database startup applies ordered migrations recorded in `schema_migrations`.
Existing MVP databases are adopted by the idempotent baseline migration without
deleting their records.

Contributors can smoke-test the complete migration sequence against a unique
operating-system temporary database:

```powershell
corepack pnpm --filter @future/db migration:smoke
```

The command prints `0001_initial` through `0004_imports_external_models` in order,
then closes and removes its temporary database. It never opens `.future` or a
configured application database.

## Useful Environment Variables

- `FUTURE_DB_PATH`: SQLite database path.
- `PORT`: API port. Defaults to `4174`.
- Provider secret references use environment-variable names such as
  `FUTURE_MODEL_KEY`; secret values are not stored in SQLite or returned to the
  browser.

Example:

```powershell
$env:FUTURE_DB_PATH = ".future/dev.sqlite"
$env:PORT = "4174"
corepack pnpm --filter @future/api dev
```

## Mock Provider Flow

The mock provider requires no API key. It is used by the command runner and
Playwright hero flow to prove the local command loop without external network
model calls.

The implemented loop is:

1. Create a workspace through `POST /api/workspaces`.
2. Import Markdown, text, or ChatGPT export content through `POST /api/imports`.
3. Create and approve a memory through `POST /api/memories` and
   `POST /api/memories/:id/promote`.
4. Preview context through `POST /api/context-packs/preview`.
5. Run `ask_with_memory` through `POST /api/commands`.
6. Inspect the audit trail through `GET /api/timeline`.

## V2 Continuous Assistant Flow

After first-run setup, the browser presents one persistent composer below the live
timeline. The active workspace changes the retrieval/display lens; it does not
create another assistant or conversation.

The protected V2 lifecycle is:

1. `POST /api/v2/assistant-turns` persists a queued turn and user message using a
   client-generated idempotency key.
2. `POST /api/v2/assistant-turns/:id/stream` builds hybrid local context and streams
   `started`, `context`, `delta`, and one terminal SSE frame.
3. The API retrieves approved, non-outdated memories, matching document chunks,
   and recent text-bearing events from the active workspace.
4. A completed answer, model-call metadata, citations, and turn references are
   committed to SQLite before the terminal frame is sent.
5. `POST /api/v2/assistant-turns/:id/cancel` aborts active provider work. Cancelled
   and failed turns write safe terminal timeline events without a completed answer.
6. `GET /api/v2/timeline?workspaceId=...&after=...` returns new SQLite events in
   stable cursor order.
7. `GET /api/v2/context-packs/:id` returns the exact immutable memory, document,
   and event sources used, along with model and token metadata.

The mock adapter emits deterministic incremental chunks offline. Ollama calls
`/api/generate` with `stream: true` and parses newline-delimited response chunks.
Provider failures expose a safe browser message; raw prompts and provider errors
are not written into failure events.

## Phase 3 Memory and Hybrid Retrieval

Open **Memory** in the left rail to create or review memory, create a virtual
namespace, edit and pin a record, change its review state, inspect revisions and
provenance, create a source-linked compaction from its inspector, or delete it
after confirmation. The persistent assistant composer remains available in the
Memory lens. Deleted records remain absent from ordinary lists and retrieval;
an explicit `?includeDeleted=true` detail request can inspect the tombstone.

Protected resources are:

- `GET|POST /api/v2/memories`
- `GET|PATCH|DELETE /api/v2/memories/:id`
- `GET /api/v2/memories/:id/revisions`
- `GET|POST /api/v2/namespaces`
- `POST /api/v2/memory-compactions`
- `GET /api/v2/search`

Migration `0003_memory_hybrid_retrieval` indexes active document chunks,
approved/non-outdated memories, text-bearing timeline events, and active
compactions with FTS5. Context construction adds pinned memory and recent events,
suppresses sources represented by an active compaction, ranks deterministically,
and persists exact ranking explanations in the immutable context pack.

Set an optional `embeddingModel` when creating a model profile to enable vector
augmentation. Ollama uses `/api/embed`; OpenAI-compatible providers use
`/embeddings` and resolve their `env:` secret reference only at call time. Secrets,
provider response bodies, and raw failures are never persisted. Missing,
unreachable, or invalid embedding adapters produce visible lexical-only metadata
and do not fail the assistant turn.

## Verification Commands

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm --filter @future/web build
corepack pnpm test:e2e
git diff --check
```

`pnpm check` runs typecheck, lint, and unit tests. `pnpm test:e2e` starts the API
and web app with an in-memory test database, then runs the browser-driven first-run
and continuous-assistant flow in Chromium. The Playwright flow creates all state
through visible browser controls; it does not drive setup or assertions through
direct API requests.

The browser suite also creates, namespaces, approves, pins, outdates, corrects,
and deletes memory, then proves later answers stop citing unavailable memory and
that deletion remains effective after reload.

The first browser scenario performs visible first-run setup, imports the bundled
Markdown source, retries an interrupted checkpoint, receives a cited answer, and
opens the immutable local context. The Phase 4 scenario proves both external
approval and denial; denial leaves the deterministic provider call count
unchanged.

## Phase 4 Imports and External Models

Open **Imports** to upload `.md`, `.markdown`, `.txt`, or ChatGPT `.json` files.
The protected multipart boundary accepts at most 10 files, 25 MiB per file, and
50 MiB total. Each file owns a persisted job and checkpoint. A failed file keeps
its completed documents, chunks, and FTS rows; **Retry** resumes the unfinished
checkpoint without duplicating durable work.

Create an OpenAI-compatible provider with an explicit HTTP(S) base URL and a
secret environment-variable name. Only the `env:NAME` reference is persisted;
the value is resolved immediately before the call. For example:

```powershell
$env:FUTURE_OPENAI_API_KEY = "your-key"
corepack pnpm dev
```

External turns build context locally, redact the complete final prompt, and stop
in `awaiting_approval`. The browser shows the exact redacted prompt, selected and
excluded sources, source ranges, privacy labels, token estimate, redaction counts,
and immutable binding hash. Approval resumes the same turn. Denial, expiry,
binding changes, and cancellation prevent the model call and remain auditable.

The Phase 4 Playwright scenario uses isolated ports `4273`, `4274`, and `4280`, a
deterministic local OpenAI-compatible server, an in-memory database, and a
one-shot test-only import interruption. It requires no external network or key.
For custom dev origins, set a comma-separated allowlist:

```powershell
$env:FUTURE_ALLOWED_ORIGINS = "http://127.0.0.1:4173"
```

## Manual External-Provider Privacy Boundary

Run this checklist before a release that changes external-provider, prompt,
permission, citation, or failure behavior. Any OpenAI-compatible endpoint is
suitable, including a local request recorder; no paid service is required. Use a
fresh temporary database and only the synthetic values below. Never substitute
personal data or a production credential.

Synthetic fixture content:

```text
PRIVACY_TEST_ACCOUNT=demo.user@example.test
PRIVACY_TEST_PRIVATE=sk-test-singularity-not-a-real-secret
```

- [ ] Start Singularity with a temporary `FUTURE_DB_PATH`. Configure an
      OpenAI-compatible provider whose secret reference is
      `env:FUTURE_PRIVACY_TEST_KEY`, set that environment variable to a disposable
      test credential, and confirm the provider reports that a key resolves without
      displaying or returning its value.
- [ ] Import a text file containing the synthetic fixture. Ask a question that
      selects it, then inspect the exact prompt preview. Confirm the account remains
      visible as context, the `PRIVACY_TEST_PRIVATE` value is replaced by a redaction
      marker, excluded/selected sources and ranges are present, and the provider,
      model, context-pack hash, prompt hash, and binding hash match the pending turn.
- [ ] Record the endpoint request count, choose **Deny**, and confirm the count does
      not change. Confirm the timeline records `grant_denied` for that turn and no
      completed model call or assistant answer.
- [ ] Create the same turn again, choose **Approve**, and confirm exactly one request
      reaches the endpoint. Confirm the answer completes with citations and its
      context inspector opens the immutable source ranges used by the approved
      preview.
- [ ] Configure the endpoint—not the imported fixture—to return a synthetic failure
      whose body contains `synthetic-provider-body-must-not-persist`, approve one
      more turn, and confirm the UI and timeline show only the safe provider failure
      code rather than the raw response body.
- [ ] Inspect `prompt_previews.redacted_prompt`, `events.payload_json`,
      `model_calls.error_message`, and the timeline/API response. The real value of
      `FUTURE_PRIVACY_TEST_KEY`, the unredacted `PRIVACY_TEST_PRIVATE` value, and the
      raw synthetic provider-error marker must have zero matches in those fields.
      The imported fixture may remain in import/document storage by design; this
      check is specifically for outbound previews, audit events, failures, and keys.
- [ ] Stop Singularity and remove the temporary test database. Preserve only the
      pass/fail observations, endpoint call counts, hashes, and safe error codes;
      do not retain request bodies or the disposable credential.

## Reset Local Data

Stop running dev servers, then remove local generated data:

```powershell
Remove-Item -Recurse -Force .future
```

Do not remove committed files or migration/schema files when resetting local
data.
