# Future End-to-End Design

Date: 2026-07-04

Status: Canonical build design for the first implementation pass

## Purpose

This document turns the existing Future product notes into one complete design
that an implementation agent can build from. It resolves the open questions in
the earlier docs, defines the first user-visible workflow, and gives the system
boundaries for the app, data store, memory layer, retrieval, providers,
permissions, and testing.

## Product Decision Summary

- Product name: Future.
- First release audience: developers and power users, with the first demo
  optimized around a developer workspace because it exercises files, imported
  chats, memory, retrieval, permissions, and model routing in one workflow.
- First app shell: plain local web app launched from the user's machine.
  Desktop packaging is deferred until the local command center proves the core
  loop.
- First backend: TypeScript Node service with a schema-validated HTTP API.
- First frontend: TypeScript React app built with Vite.
- First storage layer: SQLite for local truth, SQLite FTS5 for lexical search,
  and a vector-search adapter that starts as optional so the MVP can ship with
  lexical retrieval first.
- First model path: OpenAI-compatible adapter plus local Ollama-compatible
  endpoint support. Provider-specific adapters come after the common flow works.
- First privacy posture: prompt preview is on by default for external models;
  local-only workspaces can disable external model use entirely.
- First action posture: read/search/summarize/plan/draft are available in MVP;
  write-file and run-command actions are proposed but require explicit approval.

## First Hero Workflow

The first demo should prove this loop end to end:

1. User launches Future locally.
2. User selects a storage directory.
3. User adds one external provider or one local endpoint.
4. User creates a workspace for a repository or notes folder.
5. User imports a ChatGPT export, Markdown files, plain text files, or a project
   folder.
6. Future records import events, extracts text, chunks content, indexes lexical
   search, and proposes memories.
7. User reviews proposed memories, promotes useful ones, edits weak ones, and
   deletes bad ones.
8. User runs "Ask with memory" from the command palette.
9. Future builds a context pack, shows cited memories and files, applies
   redaction policy, and displays a prompt preview before an external model call.
10. User approves the call.
11. Future streams the answer, cites source events and memories, and writes the
    command, context pack, model call, response, and permission decisions to the
    timeline.

The workflow is successful when the user can answer: what was imported, what was
remembered, which context was sent to which model, what the assistant did, and
how to revoke or correct any of it.

## User Experience Design

### Application Layout

Future opens to a dense command-center layout:

- Left rail: workspace switcher, timeline, memory, imports, providers,
  permissions, settings.
- Top bar: active workspace, current model profile, privacy state, command
  palette trigger, sync/offline indicator.
- Main panel: current view such as timeline, memory browser, import review, or
  prompt preview.
- Right inspector: selected event, memory, provider, permission request, context
  pack, or source preview.
- Bottom activity strip: running jobs, pending approvals, recent errors, and
  last model call.

This keeps the first viewport useful. The product should not start with a
marketing page, empty hero card, or isolated chat thread.

### Command Palette

The command palette is the primary action surface. The first commands are:

- Ask with memory
- Search memory
- Search workspace
- Import files
- Import chat export
- Review proposed memories
- Review permissions
- Switch model profile
- Build prompt preview
- Summarize workspace
- Plan task
- Draft response
- Remember selected text
- Forget selected memory

Every command creates a timeline event, even if it fails or is cancelled.

### Timeline

The timeline is the audit log and navigation backbone. It shows commands,
imports, model calls, responses, memory changes, permission requests, approvals,
denials, action proposals, action results, and errors.

Each event has:

- stable ID
- workspace ID
- event type
- actor
- title
- structured payload
- source links
- privacy labels
- model/provider metadata when relevant
- created timestamp

The timeline supports filters for workspace, event type, source, date, model,
permission, memory type, label, and confidence.

### Memory Browser

The memory browser makes assistant memory visible and editable. It has views for
facts, episodes, procedures, decisions, tasks, people, projects, pinned memories,
uncertain memories, and recently used memories.

Each memory card shows:

- statement or summary
- memory type
- scope
- confidence
- source count
- last confirmed date
- privacy label
- review state
- retrieval use count

Actions are edit, delete, pin, merge, split, relabel, mark outdated, and show
sources. Deleting memory removes it from retrieval. Source events remain unless
the user purges the underlying import or event.

### Provider Panel

The provider panel manages local and external models. It supports:

- OpenAI-compatible provider
- Ollama-compatible local endpoint
- provider display name
- base URL
- API key reference
- default model
- context window
- streaming support
- embedding support
- local/external classification
- allowed workspaces
- prompt preview requirement

Secrets are stored through the local secret adapter, not in SQLite rows,
timeline payloads, vector indexes, logs, or exported diagnostics.

### Permissions Panel

The permission panel shows capability state, pending requests, recent uses, and
workspace overrides. Every capability can be:

- denied
- ask every time
- allowed for session
- allowed for workspace
- always allowed

Default MVP states:

- Read imported content: allow for workspace after first approval.
- Write memory: ask every time during first-run review, then allow for
  workspace.
- Use external models: ask every time unless the workspace explicitly allows it.
- Read arbitrary files: ask every time.
- Write files: ask every time.
- Run commands: ask every time.
- Browse web: deny in MVP unless added as a plugin later.
- Call APIs beyond model providers: deny in MVP.
- Access contacts, call people, access vault, install tools, run background
  tasks: deny in MVP.

## System Architecture

### Process Model

The MVP runs as two local processes:

- Web client: Vite React app served locally in development and bundled for
  local production.
- API worker: TypeScript Node service that owns SQLite, indexing jobs, provider
  calls, permission decisions, and imports.

The browser never reads the SQLite database or filesystem directly. It calls the
local API. That preserves a single authorization boundary and makes desktop
packaging easier later.

### Repository Shape

The implementation should become a TypeScript monorepo:

```text
apps/
  web/
    src/
      app/
      components/
      features/
      routes/
      styles/
  api/
    src/
      server/
      routes/
      jobs/
      services/
packages/
  core/
    src/
      ids.ts
      events.ts
      memory.ts
      providers.ts
      permissions.ts
  db/
    src/
      schema.ts
      migrate.ts
      connection.ts
      repositories/
    migrations/
  importers/
    src/
      chatgpt.ts
      markdown.ts
      text.ts
      filesystem.ts
  memory/
    src/
      extractor.ts
      reviewer.ts
      compactor.ts
  providers/
    src/
      registry.ts
      openai-compatible.ts
      ollama.ts
      mock.ts
  retrieval/
    src/
      lexical.ts
      vector.ts
      context-pack.ts
  permissions/
    src/
      engine.ts
      redaction.ts
tests/
  e2e/
docs/
  superpowers/
    specs/
    plans/
```

### Core Domain Boundaries

- `core` defines shared types and pure domain contracts.
- `db` owns SQL schema, migrations, repositories, and transactions.
- `importers` converts external data into normalized events and source
  documents.
- `memory` extracts, reviews, promotes, compacts, and invalidates memories.
- `retrieval` builds context packs from timeline, memory, source chunks, and
  workspace state.
- `providers` executes model and embedding calls behind a common interface.
- `permissions` decides whether an action is denied, allowed, or needs approval.
- `api` coordinates services and exposes local HTTP routes.
- `web` renders the command center and approval flows.

Each package should expose narrow functions. UI components should not assemble
SQL queries, call model providers, or perform permission logic.

## Data Model

SQLite is the local source of truth. The schema starts with these tables:

### Workspace Tables

- `workspaces`: `id`, `name`, `kind`, `root_path`, `privacy_mode`,
  `default_model_profile_id`, `created_at`, `updated_at`, `archived_at`.
- `workspace_labels`: `id`, `workspace_id`, `name`, `color`, `created_at`.

### Timeline Tables

- `events`: `id`, `workspace_id`, `type`, `actor`, `title`, `payload_json`,
  `privacy_json`, `created_at`.
- `event_sources`: `event_id`, `source_type`, `source_id`, `range_json`.
- `timeline_labels`: `event_id`, `label_id`.

Events are append-first. Destructive user operations create deletion events and
either tombstone or purge underlying records according to the workspace policy.

### Import Tables

- `imports`: `id`, `workspace_id`, `kind`, `source_path`, `status`,
  `started_at`, `finished_at`, `error_message`.
- `documents`: `id`, `workspace_id`, `import_id`, `title`, `source_uri`,
  `media_type`, `hash`, `text_path`, `created_at`.
- `document_chunks`: `id`, `document_id`, `chunk_index`, `text`, `token_count`,
  `source_range_json`, `embedding_status`, `created_at`.
- `document_chunks_fts`: FTS5 virtual table for `chunk_id`, `title`, and
  `text`.

### Memory Tables

- `memories`: `id`, `workspace_id`, `type`, `statement`, `summary`,
  `confidence`, `scope_json`, `privacy_json`, `review_state`, `pinned`,
  `outdated_at`, `last_confirmed_at`, `created_at`, `updated_at`.
- `memory_sources`: `memory_id`, `source_type`, `source_id`, `range_json`.
- `memory_revisions`: `id`, `memory_id`, `previous_json`, `next_json`,
  `reason`, `created_at`.
- `compactions`: `id`, `workspace_id`, `kind`, `summary`, `source_event_ids`,
  `created_at`.

### Provider Tables

- `providers`: `id`, `kind`, `display_name`, `base_url`, `api_key_ref`,
  `is_local`, `capabilities_json`, `created_at`, `updated_at`.
- `model_profiles`: `id`, `provider_id`, `name`, `model`, `context_window`,
  `purpose`, `temperature`, `privacy_policy`, `created_at`, `updated_at`.
- `model_calls`: `id`, `workspace_id`, `provider_id`, `model_profile_id`,
  `context_pack_id`, `status`, `input_tokens`, `output_tokens`,
  `error_message`, `created_at`, `finished_at`.

### Permission Tables

- `permission_rules`: `id`, `workspace_id`, `capability`, `state`, `scope_json`,
  `expires_at`, `created_at`, `updated_at`.
- `permission_requests`: `id`, `workspace_id`, `capability`, `reason`,
  `data_access_json`, `decision`, `created_at`, `decided_at`.

### Retrieval Tables

- `context_packs`: `id`, `workspace_id`, `command_event_id`,
  `model_profile_id`, `budget_json`, `items_json`, `redactions_json`,
  `created_at`.
- `retrieval_runs`: `id`, `workspace_id`, `query`, `strategy`, `result_json`,
  `created_at`.

### Job Tables

- `jobs`: `id`, `workspace_id`, `kind`, `status`, `input_json`, `result_json`,
  `error_message`, `created_at`, `started_at`, `finished_at`.

## API Surface

The local API is intentionally small:

- `GET /api/health`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/timeline?workspaceId=&type=&q=`
- `GET /api/events/:id`
- `POST /api/commands`
- `GET /api/jobs/:id`
- `POST /api/imports`
- `GET /api/imports/:id`
- `GET /api/memories?workspaceId=&type=&reviewState=&q=`
- `PATCH /api/memories/:id`
- `DELETE /api/memories/:id`
- `POST /api/memories/:id/promote`
- `POST /api/context-packs/preview`
- `POST /api/model-calls`
- `GET /api/providers`
- `POST /api/providers`
- `PATCH /api/providers/:id`
- `DELETE /api/providers/:id`
- `GET /api/permissions`
- `POST /api/permission-requests/:id/decide`

Every mutating route writes a timeline event in the same transaction or records a
failure event when the transaction cannot complete.

## Memory Design

### Memory Types

- Fact: stable statement about the user, project, preference, constraint, or
  environment.
- Episode: source-backed record of what happened.
- Procedure: reusable instruction for how the user wants work done.
- Decision: explicit choice, tradeoff, or rejection.
- Task: active or historical work item.
- Summary: compacted view of many events or documents.

### Review States

- proposed: extracted but not used in retrieval unless explicitly selected.
- approved: eligible for retrieval.
- rejected: retained only as an audit record unless purged.
- outdated: hidden from normal retrieval but available in source history.
- pinned: always considered during context-pack construction for its workspace.

### Promotion Rules

The MVP should require review before promoting:

- personal facts
- procedures that change assistant behavior
- secrets or credential-like text
- memories with confidence under 0.8
- memories extracted from imported third-party chats

The MVP can auto-approve low-risk workspace summaries and import summaries, but
still shows them in "recently created memory."

## Retrieval Design

Retrieval produces a context pack rather than directly appending search results
to a prompt. A context pack contains:

- command intent
- active workspace summary
- relevant approved memories
- pinned memories
- recent timeline events
- source snippets from imported documents
- permission state
- selected attachments
- redaction decisions
- citation IDs

The first retrieval strategy is hybrid-lite:

1. Run SQLite FTS over memories and document chunks.
2. Boost pinned, recent, high-confidence, same-workspace, and source-linked
   memories.
3. Add recent timeline events for the active workspace.
4. Deduplicate near-identical snippets by source ID and text hash.
5. Fit selected items into the model profile's context budget.
6. Return a previewable context pack before external model calls.

Vector search is behind a `VectorIndex` interface. The MVP may ship with a noop
implementation and turn on sqlite-vec or another local vector backend after the
lexical flow is stable.

## Provider Design

The provider interface is:

```ts
export interface ModelProvider {
  id: string;
  kind: "openai-compatible" | "ollama" | "mock";
  listModels(): Promise<ModelDescriptor[]>;
  streamText(request: ModelTextRequest): AsyncIterable<ModelTextChunk>;
  createEmbedding?(request: EmbeddingRequest): Promise<EmbeddingResult>;
}
```

OpenAI-compatible endpoints and Ollama-compatible local endpoints implement the
same text-generation contract. Provider-specific features are exposed through
capabilities rather than hard-coded UI branches.

## Permission and Privacy Design

Before a sensitive action, the API calls the permission engine with:

- workspace ID
- capability
- requested data
- destination
- model/provider
- persistence scope
- reason

The engine returns one of:

- deny
- allow
- needs approval

External model calls require a prompt preview unless the workspace has a valid
rule allowing external model use without preview. Prompt preview shows:

- provider and model
- context-pack items
- estimated token count
- redacted fields
- source citations
- memory IDs
- privacy labels

Secrets and API keys use a `SecretStore` adapter. The first web-only MVP can use
an encrypted local development fallback, but any packaged desktop build must use
OS-backed storage such as Windows Credential Manager, macOS Keychain, or Linux
Secret Service.

## Error Handling

Future should prefer visible partial progress over silent failure.

- Import failure: record failed import event with file path, parser, and error.
- Memory extraction failure: keep raw event and document chunks; mark job failed.
- Provider failure: record model call failure and preserve the context pack.
- Permission denial: record denial and show the blocked action.
- Redaction failure: block external model call and show the failed detector.
- Database migration failure: stop startup and show the migration name.
- Corrupt import: skip the corrupt item, continue the batch, and show a review
  list.

The assistant should not fabricate missing source context. If retrieval finds no
strong source, the answer must say that it is answering without stored memory.

## Testing Strategy

The first implementation should include:

- domain unit tests for IDs, event payload validation, permissions, and memory
  state transitions
- SQLite repository tests using a temporary database
- import parser tests with fixture exports and text files
- retrieval tests for FTS ranking, deduplication, and context budgets
- redaction tests for API keys, tokens, email addresses, phone numbers, and
  private paths
- provider adapter tests with mocked streaming responses
- API route tests for timeline, imports, memories, providers, permissions, and
  commands
- Playwright tests for first-run, import review, memory edit/delete, prompt
  preview, and source-backed answer flow

The implementation is not ready until a clean checkout can run install,
typecheck, lint, unit tests, and the first Playwright smoke test.

## Build Milestones

### Milestone 1: Local Shell and Data Spine

Build the monorepo, local API, SQLite schema, event store, timeline view, and
workspace creation. The app can start locally and record events.

### Milestone 2: Imports and Search

Add Markdown, plain text, ChatGPT export import, document chunking, and SQLite
FTS search. The app can import context and search it.

### Milestone 3: Memory Review

Add memory proposal, review, edit, delete, source inspection, and retrieval
eligibility. The app can create inspectable memory.

### Milestone 4: Providers and Prompt Preview

Add provider configuration, model profiles, mock provider, OpenAI-compatible
adapter, Ollama-compatible adapter, context-pack preview, and model-call
timeline events.

### Milestone 5: Permissions and First Demo

Add permission rules, approval requests, prompt privacy gates, approved command
execution, and Playwright coverage for the hero workflow.

## Deferred Decisions

These are intentionally outside the first implementation pass:

- packaged desktop wrapper
- plugin marketplace
- hosted sync
- email, calendar, Slack, Discord, Telegram, WhatsApp, and phone integrations
- autonomous background agents
- multi-user team workspaces
- smart cost-based model routing
- graph memory beyond source-linked records

## Implementation References

- Vite guide: <https://vite.dev/guide/>
- React app build guidance: <https://react.dev/learn/build-a-react-app-from-scratch>
- Fastify TypeScript and schema validation docs:
  <https://fastify.io/docs/latest/Reference/TypeScript/>
- SQLite FTS5 docs: <https://www.sqlite.org/fts5.html>
- sqlite-vec docs: <https://alexgarcia.xyz/sqlite-vec/>
- Drizzle SQLite docs:
  <https://orm.drizzle.team/docs/sqlite/get-started-sqlite>
- Playwright docs: <https://playwright.dev/>
- Tauri security docs for the later desktop wrapper:
  <https://v2.tauri.app/security/>
- Electron safeStorage docs if Electron becomes the wrapper:
  <https://electronjs.org/docs/latest/api/safe-storage>

