# Future V2 Phase 3 Memory and Hybrid Retrieval Design

Date: 2026-07-11

Status: Approved design; implementation planning pending written-spec review

## Purpose

Phase 3 turns the Phase 2 continuous-assistant slice into a user-manageable,
source-backed memory system. It adds complete lexical retrieval across events,
memories, and document chunks; optional vector retrieval through noop, Ollama,
and OpenAI-compatible adapters; memory namespaces and revisions; and browser
flows for reviewing, correcting, pinning, outdating, deleting, and compacting
memory.

The implementation extends the existing assistant-turn, context-pack, citation,
workspace, provider, and timeline contracts. It does not create another chat,
retrieval endpoint, or model execution path.

## Scope

Phase 3 delivers:

- SQLite FTS5 indexing and workspace-scoped search for document chunks, approved
  memories, and text-bearing timeline events
- optional vector retrieval over the same authorized source set using noop,
  Ollama, and OpenAI-compatible embedding adapters
- deterministic hybrid ranking, source-quality weighting, recency, confidence,
  pinning, diversity, deduplication, and model-context budgeting
- immutable context packs containing normalized citations, exact selected text,
  ranking metadata, model metadata, and redaction results
- shallow virtual memory namespaces with one optional child level, primary and
  secondary membership, and user-created or suggested organization
- review, edit, pin, outdate, delete, and revision-history operations with
  transactional timeline events
- source-linked compactions that summarize older events or related memories while
  preserving provenance and excluding replaced material from normal retrieval
- browser memory-management and retrieval-inspection flows
- unit, repository, API, React, and browser coverage plus updated operational docs

Phase 3 does not add browser imports, resumable indexing jobs, OpenAI-compatible
text generation, external prompt approvals, reminders, scheduled jobs, filesystem
memory directories, or automatic unreviewed organization. Those remain in later
phases.

## Architecture

### Domain contracts

`@future/core` owns provider-neutral contracts for namespaces, namespace
memberships, memory revisions, compactions, embedding requests/results, vector
candidates, retrieval runs, ranking explanations, and V2 API DTOs. Existing
source references continue to identify `memory`, `document`, and `event` sources.
New fields remain additive so persisted Phase 2 context packs and timeline events
can still be read.

### Persistence and transactions

Migration `0003_memory_hybrid_retrieval` adds namespace, membership, revision,
compaction, and embedding-index tables plus FTS structures for memories and event
text. Existing document FTS data is adopted without destructive rebuilding.
Triggers or repository-owned synchronization keep searchable text aligned with
mutable records. Startup and upgrade tests prove the migration applies once,
preserves Phase 2 data, and produces deterministic checksums.

Every meaningful memory mutation and its timeline event commit in one database
transaction. A revision stores the prior and resulting content, status, namespace
assignments, pin state, editor, timestamp, and source linkage. Deletion is a
retrieval tombstone rather than destruction of provenance; the API never returns
deleted memory in ordinary lists or retrieval. Outdated memory remains inspectable
but is excluded from normal retrieval.

### Memory service

An API `MemoryService` coordinates repositories and the pure `@future/memory`
state machine. It provides list/detail, review, edit, pin, outdate, delete,
namespace assignment, revision history, and compaction operations. Invalid state
transitions return stable V2 errors. Suggested namespaces require confirmation;
Phase 3 does not enable automatic organization.

Compaction is deterministic and local in this phase. A caller selects eligible
older events or approved memories and supplies or derives a concise summary. The
compaction stores all input source references and a content hash. Inputs remain
auditable, while the retrieval planner suppresses them when the active compaction
represents the same knowledge. Editing or deleting an input invalidates the
compaction so stale summaries cannot silently win retrieval.

### Embedding adapters

`@future/retrieval` defines a small embedding adapter contract and vector-index
contract. The noop adapter reports that vector retrieval is unavailable without
failing a turn. The Ollama adapter calls the configured local embedding endpoint.
The OpenAI-compatible adapter calls the configured embeddings endpoint and uses
the existing secret-reference boundary; secrets never enter SQLite, logs,
timeline payloads, context packs, or diagnostics.

Embedding records are keyed by source kind, source ID, content hash, adapter,
model, and dimensions. Changed or deleted source text invalidates prior vectors.
Adapter failure degrades visibly to lexical retrieval and records safe retrieval
metadata; it does not fail an otherwise answerable assistant turn.

### Retrieval pipeline

For every existing Phase 2 assistant turn, `ContextService`:

1. Resolves the active workspace and authorized source scopes.
2. Queries FTS5 across document chunks, approved non-outdated memories, and
   earlier text-bearing events.
3. Optionally queries the configured vector adapter and vector index over the
   same authorized sources.
4. Adds pinned memories and bounded recent high-value events.
5. Normalizes lexical and vector scores before applying source quality,
   confidence, recency, pin, scope, and diversity weights.
6. Deduplicates identical hashes and overlapping excerpts, preferring the most
   direct and highest-quality source.
7. Suppresses inputs represented by a valid active compaction.
8. Fits candidates into the selected model profile's context budget with reserved
   space for instructions, the user message, and output.
9. Applies the existing privacy and redaction boundary.
10. Persists one immutable context pack and its normalized citations before model
    execution.

Lexical retrieval is the baseline and works with no embedding configuration or
network. Stable tie-breakers use source kind and source ID so identical inputs
produce identical packs. Context-pack inspection exposes why each item was
selected without exposing secrets or raw provider errors.

## API and browser experience

Protected `/api/v2` routes add memory, namespace, compaction, and search resources.
Mutation schemas reject unknown fields. List routes are workspace-scoped and use
stable cursors. Detail responses expose provenance and revision history but never
secret references.

The left rail gains namespace navigation and a memory review-queue count. The
center memory view supports status and namespace filters. Selecting a memory opens
the right inspector with content, source links, confidence, tags, namespaces,
pin/status controls, and revision history. Destructive deletion requires explicit
confirmation. Editing creates a revision; outdating and pinning update retrieval
immediately after the mutation succeeds.

The existing assistant composer remains the only answer path. Context inspection
adds lexical/vector contribution, ranking reasons, compaction provenance, and any
visible lexical-only fallback. A browser scenario proves that correcting,
outdating, pinning, and deleting memory changes later context selection and cited
answers.

## Error handling

- Embedding timeout, unsupported dimensions, or unreachable endpoints fall back
  to lexical retrieval with a safe diagnostic marker.
- FTS/index synchronization failure preserves source records, fails the mutation
  transaction when consistency cannot be maintained, and surfaces a stable error.
- Namespace cycles or depth beyond root plus one child are rejected.
- Revision conflicts use optimistic version checks and return a conflict instead
  of overwriting newer content.
- Invalid compactions, missing inputs, cross-workspace sources, and already
  invalidated compactions are rejected.
- Deleted or outdated memories cannot re-enter normal retrieval through stale FTS
  rows or embeddings.
- Context-pack persistence remains a prerequisite for starting provider execution.

## Testing and acceptance evidence

Implementation follows red-green-refactor slices. Completion requires evidence
for all of the following:

1. Migration tests cover clean startup, Phase 2 upgrade, checksum stability, and
   preservation of existing turns, context packs, citations, and events.
2. Repository tests prove namespace depth, memberships, revision history,
   tombstones, FTS synchronization, embedding invalidation, and transactional
   mutation events.
3. Pure retrieval tests prove event/memory/document lexical ranking, vector score
   fusion, authorization, stable ordering, pinned-memory behavior, diversity,
   deduplication, compaction suppression, and budget limits.
4. Adapter contract tests prove noop behavior, Ollama and OpenAI-compatible request
   shapes, response validation, secret handling, cancellation, and safe fallback.
5. API tests prove local-session/origin protection, strict validation, cursors,
   review/edit/pin/outdate/delete flows, namespaces, revisions, compaction, search,
   and stable error envelopes.
6. React tests prove review filters, namespace navigation, editing, confirmations,
   revision inspection, ranking explanations, and fallback visibility.
7. Playwright performs setup and all Phase 3 memory/retrieval assertions entirely
   through browser controls, including a changed source-backed answer after memory
   correction and removal.
8. `docs/context.md`, the build runbook, and release checklist describe Phase 3
   architecture, operation, fallback behavior, and exact gates.
9. A frozen install, repository checks, web production build, Playwright suite,
   migration verification, and `git diff --check` all pass from the final state.

## Resolved decisions

- The V2 continuous-assistant design is the source of truth when the older roadmap
  uses broader or differently numbered phase labels.
- Phase 3 includes noop, Ollama, and OpenAI-compatible embedding adapters.
- Embeddings are optional augmentation; lexical retrieval remains complete and
  offline-capable.
- OpenAI-compatible embeddings do not pull external text-generation or prompt
  approval work forward from Phase 4.
- Memory namespaces are virtual SQLite records with one optional child level.
- Memory edits create immutable revisions; delete is a retrieval tombstone.
- Compactions retain source provenance and invalidate when their inputs change.
- All retrieval flows extend the existing Phase 2 assistant turn and immutable
  context-pack path.
