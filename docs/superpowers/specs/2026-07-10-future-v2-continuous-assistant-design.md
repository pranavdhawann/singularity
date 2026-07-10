# Future V2 Continuous Assistant Design

Date: 2026-07-10

Status: Approved product design; implementation planning pending written-spec review

## Purpose

Future V2 turns the existing backend-heavy MVP into a usable, local,
model-agnostic personal assistant. The product has one continuous relationship
with the user rather than a collection of disconnected chats. It stores its
history on the user's computer, organizes durable memory, retrieves relevant
context with RAG, explains what it used, and can perform proactive local work
when the user explicitly enables it.

The architecture is a modular local-assistant core with stable extension seams.
This delivers the main experience before introducing the complexity of a broad
plugin marketplace or a desktop wrapper. It preserves the long-term ambition of
an open-source personal assistant platform comparable to OpenClaw while making
memory quality, model freedom, transparency, and user control the differentiators.

## Product Thesis

Future is one persistent assistant, not a chat manager.

The user should never need to choose which old conversation contains the answer.
Future records interactions, imports, decisions, memories, tasks, and actions in
one durable event history. Workspaces, projects, people, and memory categories are
lenses over that history. They provide scope without fragmenting the assistant
into separate identities or chat threads.

Future's core promises are:

- one continuous assistant relationship
- local ownership of history, memory, indexes, and settings
- model freedom through provider-neutral contracts
- source-backed retrieval across authorized local knowledge
- visible, editable, and deletable memory
- explicit permissions before sensitive or external actions
- optional proactivity that remains auditable and controllable
- open-source boundaries that contributors can extend without rewriting the core

## Goals

V2 must:

1. Connect the browser interface to the local API and database.
2. Provide one continuous assistant timeline and composer.
3. Support mock, Ollama, and persisted OpenAI-compatible providers.
4. Stream model responses to the browser.
5. Retrieve from approved memory, imported documents, and relevant timeline events.
6. Show citations, context-pack contents, redactions, and model metadata.
7. Extract, categorize, review, edit, pin, outdate, and delete memories.
8. Import real Markdown, text, and ChatGPT export files from the browser.
9. Enforce prompt preview and permissions for external calls.
10. Support opt-in local reminders and scheduled review jobs.
11. Introduce versioned database migrations before user data becomes valuable.
12. Establish clean contracts for later tools, connectors, and plugins.
13. Pass clean-install, typecheck, lint, unit, integration, build, and browser tests.

## Non-Goals

V2 does not include:

- multiple users or team workspaces
- cloud synchronization or hosted accounts
- a marketplace
- mobile applications
- autonomous external actions without approval
- email, calendar, Slack, messaging, or phone connectors
- a Tauri or Electron wrapper
- provider-hosted billing
- graph memory as the primary storage model
- smart cost routing across every provider

These remain future extensions behind the same provider, tool, event, permission,
and job boundaries.

## Experience Model

### One Assistant, One Timeline

There is no chat list and no conversation ID as a user-facing organizing concept.
Every user turn, assistant response, import, memory change, permission decision,
scheduled job, and tool result becomes an event in one timeline.

The active workspace limits default retrieval and display scope, but the user can
explicitly search or reference other authorized scopes. Switching workspaces does
not create a new assistant. It changes the context lens.

The user can address prior knowledge naturally:

- "What did we decide about the database?"
- "Use my coding preferences for this plan."
- "Find the subscription renewal I mentioned last month."
- "Summarize everything related to this repository."

The assistant must distinguish stored knowledge from general model knowledge. If
retrieval finds no reliable local source, the response says that it is answering
without stored evidence.

### Interface Layout

The browser application uses three primary regions:

- Left rail: assistant home, workspaces, sources, memory namespaces, providers,
  permissions, proactive tasks, and settings.
- Center: continuous timeline, assistant responses, command results, and the
  persistent composer.
- Right inspector: selected sources, context packs, memory records, prompt preview,
  model details, approvals, and event metadata.

The command palette remains a fast secondary action surface. Natural language in
the composer is the primary interaction model.

### First-Run Flow

The first run is a guided local flow:

1. Confirm the local data directory.
2. Create the first workspace.
3. Select the mock provider, connect Ollama, or add an OpenAI-compatible endpoint.
4. Import a file or ChatGPT export.
5. Review proposed memories.
6. Ask the first source-backed question.
7. Inspect the context, citations, model, and timeline records used for the answer.

The mock provider keeps this flow fully testable without credentials or network
access.

## System Architecture

### Process Model

V2 remains a local browser application with two development processes:

- React/Vite web client
- Fastify local API worker

The API owns SQLite, migrations, indexing, provider calls, jobs, permissions, and
filesystem access. The browser never reads SQLite or arbitrary local files
directly. Development uses a Vite proxy to the API. Production local serving can
serve the built web application from the API process without changing client API
contracts.

The API binds to `127.0.0.1`. A local session token and origin validation protect
state-changing routes from unrelated browser pages. The token is generated at
startup and passed to the locally served client without entering timeline data or
model context.

### Module Boundaries

Existing packages remain and gain narrower responsibilities:

- `@future/core`: domain contracts, event types, IDs, provider/model profiles,
  commands, permissions, memory, sources, jobs, and API DTOs.
- `@future/db`: versioned migrations, repositories, transactions, and database
  health checks.
- `@future/importers`: pure parsers and normalization for supported sources.
- `@future/memory`: extraction policy, classification, review transitions,
  compaction, and namespace suggestions.
- `@future/retrieval`: query planning, lexical search, optional vector adapters,
  ranking, deduplication, citation assembly, and context budgeting.
- `@future/providers`: provider contracts and adapters for mock, Ollama, and
  OpenAI-compatible endpoints.
- `@future/permissions`: permission evaluation, prompt-preview grants, redaction,
  and scope matching.
- `apps/api`: orchestration services, HTTP and streaming routes, jobs, local auth,
  and failure recording.
- `apps/web`: one-assistant interface, API state, streaming UI, review flows, and
  inspectors.

Provider construction, retrieval planning, and permission decisions move out of
route handlers. Routes validate input, call application services, and translate
service results into API responses.

### Application Services

The API introduces explicit services:

- `AssistantService`: runs a user turn from event creation through streamed answer.
- `ContextService`: builds and persists previewable context packs.
- `ProviderService`: loads persisted providers and model profiles into runtime
  adapters.
- `MemoryService`: proposes, reviews, revises, categorizes, and compacts memories.
- `ImportService`: runs imports, chunking, indexing, and failure recovery.
- `PermissionService`: evaluates rules and issues immutable approval requests.
- `JobService`: schedules and executes allowed local background work.

Each service accepts repositories and adapters through dependency injection so
tests can use in-memory databases and fake providers.

## Data Architecture

### Migrations

Schema creation moves from a collection of unconditional `CREATE TABLE IF NOT
EXISTS` statements to ordered, versioned SQL migrations. A metadata table records
the applied migration IDs and checksums. Startup applies pending migrations in a
transaction and stops with a named error if any migration fails.

Existing MVP data is preserved through an initial baseline migration and
forward-only changes. Development reset remains available as an explicit command.

### Event History

The event log remains append-first and becomes the canonical activity history.
Events gain stable typed payload contracts for:

- user messages and assistant responses
- imports and indexing
- memory proposals and revisions
- context packs and retrieval runs
- model calls and failures
- permission requests and decisions
- reminders and scheduled jobs
- tool proposals and results

Mutable domain records can change state, but every meaningful mutation writes an
event in the same transaction. Failures that occur outside a transaction write a
separate failure event with safe diagnostic metadata.

### Continuous Turns

V2 adds an explicit `assistant_turns` record to correlate the user event, context
pack, permission request, model call, streamed response, and final assistant event.
This is an execution correlation mechanism, not a user-visible conversation.

Turns have `queued`, `building_context`, `awaiting_approval`, `running`,
`completed`, `failed`, and `cancelled` states. A client-generated idempotency key
prevents duplicate turns when the browser retries.

### Sources and Citations

Documents, chunks, memories, and events are all citable sources. A normalized
source reference contains:

- source kind and stable ID
- workspace and privacy scope
- title or display label
- optional character, line, page, message, or event range
- content hash

Assistant responses store citation references separately from rendered text. The
web client can display inline markers and expandable source cards without relying
on provider-specific citation syntax.

## Memory Architecture

### Layers

Future stores four complementary memory layers:

1. Raw timeline events: complete local history and audit record.
2. Source documents and chunks: imported or indexed knowledge.
3. Durable memories: facts, episodes, procedures, decisions, tasks, and summaries.
4. Compactions: source-linked summaries of older events or related memories.

Long model context does not replace these layers. Context is assembled for each
turn from the minimum relevant source-backed set.

### Memory Namespaces

Memory "directories" are virtual namespaces stored in SQLite. Examples include
`Coding`, `Life Skills`, `Finance`, `Health`, a repository name, or a user-created
subject. A memory can belong to multiple namespaces and retain a primary namespace.

Namespaces can be created by the user or suggested by the memory classifier. New
suggested namespaces require confirmation until the user enables automatic
organization for that workspace. The hierarchy is shallow in V2: a root namespace
and one optional child level. Tags provide cross-cutting organization.

The internal source of truth is the database. A later export feature may mirror
namespaces into Markdown directories, but Future does not continuously mutate the
user's filesystem to organize memory.

### Extraction and Review

Memory extraction is hybrid:

- deterministic rules find explicit decisions, dates, reminders, and strong user
  preference language
- an optional selected model proposes richer summaries and classifications
- every proposal retains source IDs, confidence, scope, and extraction method

Personal facts, procedures, reminders, low-confidence items, and third-party chat
imports require review. Low-risk workspace summaries may be auto-approved only
when the workspace setting explicitly enables it.

Editing a memory creates a revision. Deleting removes it from retrieval and creates
a deletion event. The source record remains unless the user separately purges the
source. Marking a memory outdated preserves provenance but excludes it from normal
retrieval.

## Retrieval and Context Packs

### Retrieval Pipeline

For each assistant turn, Future:

1. Classifies the request intent and explicit scope references.
2. Resolves the active workspace and authorized cross-workspace scopes.
3. Runs SQLite FTS5 over document chunks, memories, and relevant event text.
4. Optionally runs a configured vector adapter over the same authorized sources.
5. Adds pinned memories and high-value recent events.
6. Scores candidates by relevance, source quality, confidence, recency, scope,
   pinning, and diversity.
7. Deduplicates repeated or overlapping content.
8. Fits candidates into the selected model profile's context budget.
9. Applies privacy classification and redaction.
10. Persists an immutable context pack with citations and redactions.

The first vector adapters are noop, Ollama embeddings, and OpenAI-compatible
embeddings. Lexical retrieval remains fully functional without embeddings.

### Prompt Preview

Local model calls can run without preview when workspace rules allow them. External
model calls require an immutable prompt-preview grant unless a valid rule explicitly
waives per-call review.

The preview shows:

- provider, endpoint classification, model, and profile
- final system and user instructions
- selected memories, chunks, and events
- source citations and privacy labels
- estimated tokens
- redactions and excluded sensitive items

Approval references the context-pack hash, provider ID, model, and turn ID. Any
change invalidates the grant and requires a new preview.

## Provider and Model Runtime

Persisted providers and model profiles become the runtime source of truth. Routes
do not infer provider behavior from arbitrary request strings.

V2 supports:

- `mock`: deterministic offline verification
- `ollama`: local generation and optional embeddings
- `openai-compatible`: external or local endpoints using a common contract

Provider records contain display metadata and a secret reference, never plaintext
keys. Development initially supports environment-variable secret references. A
`SecretStore` interface allows Windows Credential Manager, macOS Keychain, Linux
Secret Service, or a desktop wrapper to be added later.

Model profiles define provider, model name, context window, purpose, temperature,
privacy policy, and optional embedding model. Users can select a profile per turn
or set a workspace default. Automatic cost routing is deferred.

Text responses stream through Server-Sent Events. The final assembled response and
usage metadata are persisted when streaming completes. Cancellation records a
cancelled model call and partial-output metadata without treating the partial text
as a completed assistant answer.

## Permissions and Privacy

Capabilities retain five states: deny, ask every time, allow for session, allow
for workspace, and always allow. V2 fully implements session and workspace rules;
the UI can display global rules but creating a global always-allow rule requires an
explicit advanced confirmation.

The command flow evaluates:

- requested capability
- workspace and source scopes
- local or external destination
- provider and model profile
- data classes leaving the machine
- persistence duration
- prompt-preview requirement

Privacy-sensitive workspaces always block external model use. A broader global
permission cannot override that workspace policy.

Redaction runs over the complete outbound prompt, including retrieved memory and
document chunks. Redaction failure blocks the external call. Secrets, tokens,
private keys, and secret references never enter model context, vector indexes,
timeline payloads, or exported diagnostics.

## Proactive Local Assistance

Proactivity is disabled by default. Users enable specific job classes per workspace
or namespace.

Initial proactive capabilities are:

- reminders extracted from explicit dates or user requests
- subscription and deadline reminders created from approved memories
- scheduled workspace summaries
- stale-memory and review-queue reminders
- watched-folder reindexing after explicit folder authorization

Jobs can create timeline notifications and browser notifications. They cannot call
external models, write files, run commands, or call third-party APIs unless the
corresponding capability and background-execution permission are valid.

Every scheduled job records its trigger, inputs, permission evaluation, result,
next run, and error state. Repeated failures use bounded retries and then surface a
visible blocked job instead of looping silently.

## API Direction

The API is versioned under `/api/v2` while existing MVP routes remain available
during migration. The web app uses only V2 contracts once the vertical slice is
connected.

Primary resource groups are:

- session and health
- assistant turns and streams
- workspaces and settings
- timeline events
- sources, imports, and search
- memories, namespaces, and revisions
- context packs and prompt-preview grants
- providers and model profiles
- permissions and requests
- jobs and reminders

All mutation bodies use Fastify JSON schemas with `additionalProperties: false`
unless a field is intentionally free-form metadata. Errors follow one envelope
with a stable code, safe message, correlation ID, and optional field details.

## Error Handling and Recovery

Future favors visible partial progress over silent failure:

- Import failures preserve completed documents and identify skipped items.
- Index failures leave source text intact and expose a retry action.
- Provider failures preserve the immutable context pack and model-call metadata.
- Permission denials preserve the blocked turn and allow an explicit retry.
- Stream interruption records a cancelled or failed call without a completed answer.
- Migration failures stop startup before serving a partially compatible API.
- Job failures retry only when the error class is safe and retryable.

Logs are local, structured, and redacted. Fastify request IDs and turn IDs connect
logs to safe timeline diagnostics without logging prompt bodies or secrets.

## Open-Source and Extension Boundaries

V2 is a modular monolith, not a plugin platform. It nevertheless defines stable
interfaces for:

- model and embedding providers
- importers
- vector indexes
- secret stores
- notification sinks
- proactive job handlers
- future tools and connectors

Core packages remain framework-light and testable without the browser. Extension
contracts use versioned TypeScript types and capability declarations. Loading
untrusted third-party code in-process is deferred until sandboxing and permission
semantics are designed.

The repository will document architecture, local development, testing, security
expectations, and contribution conventions before calling V2 release-ready.

## Testing and Quality Gates

Implementation follows test-driven slices. Required coverage includes:

- pure domain tests for state transitions, ranking, permissions, and redaction
- migration and repository tests using temporary SQLite databases
- provider contract tests with mocked HTTP streams
- API tests for validation, idempotency, approvals, failures, and authorization
- React tests for timeline, composer, streaming, memory review, and inspectors
- Playwright flows that interact through the browser rather than driving the API
  directly
- clean-start and upgrade migration tests

The repository adds a real lint and formatting configuration rather than using a
second TypeScript invocation as linting.

The release gate is:

1. clean dependency install
2. formatting check
3. lint
4. typecheck
5. unit and integration tests
6. production web build
7. Playwright browser flows
8. database migration verification
9. `git diff --check`

CI runs the same commands on a supported Node version and installs the pinned
Playwright browser revision.

## Implementation Sequence

### Phase 1: Foundation and Connected Shell

- versioned migrations and repositories
- V2 error contracts and local session protection
- Vite API proxy and typed web client
- persisted provider/model runtime
- real workspace and provider setup UI

### Phase 2: Continuous Assistant Vertical Slice

- persistent composer and one timeline
- assistant-turn orchestration
- mock and Ollama streaming
- context inspector and citations
- browser-driven hero flow

### Phase 3: Memory and Hybrid Retrieval

- event, memory, and document FTS retrieval
- optional embedding adapters
- namespace organization and review UI
- memory revisions, deletion, pinning, and compaction

### Phase 4: Imports and External Models

- browser file upload and ChatGPT export flow
- resumable import/index jobs
- OpenAI-compatible runtime
- whole-prompt redaction
- immutable prompt-preview grants

### Phase 5: Proactive Assistance and Hardening

- reminders and scheduled jobs
- browser notifications and job controls
- failure recovery and structured local logging
- CI, contribution documentation, and release verification

Each phase must leave the repository runnable and verified. Later phases build on
the same assistant-turn and event contracts rather than adding parallel flows.

## V2 Acceptance Criteria

V2 is complete when a fresh clone can:

1. Install dependencies and migrate a clean database.
2. Open the browser to the continuous assistant interface.
3. Create a workspace and configure mock, Ollama, or OpenAI-compatible models.
4. Import real local files and a ChatGPT export.
5. Search and retrieve source-backed local context.
6. Review and organize extracted memories into namespaces.
7. Ask a question and receive a streamed, cited answer.
8. Inspect the exact context pack, redactions, model, and permissions used.
9. Correct, outdate, pin, or delete a memory and observe retrieval change.
10. Approve an external call through an immutable prompt preview.
11. Create an opt-in reminder and see its auditable notification.
12. Run the complete quality gate successfully in CI and locally.

## Resolved Decisions

- Future remains open source and model agnostic.
- The primary experience is one continuous assistant, not multiple chats.
- The current release remains a local browser application.
- SQLite is the local source of truth.
- Memory namespaces are virtual database records, not automatic filesystem folders.
- Lexical RAG works without embeddings; embeddings are optional adapters.
- Persisted provider and model profiles drive runtime execution.
- External prompt approval is bound to an immutable context pack.
- Proactivity is opt-in, local, permission-bound, and fully audited.
- V2 is implemented as a modular monolith with extension seams, not a plugin runtime.
- Desktop packaging, broad connectors, cloud sync, and a marketplace remain deferred.
