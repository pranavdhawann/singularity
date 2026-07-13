# Release Checklist

Use this checklist before treating the local MVP as releasable.

## Required Commands

- [ ] `corepack pnpm install` completes.
- [ ] `corepack pnpm check` passes.
- [ ] `corepack pnpm test:e2e` passes.
- [ ] `corepack pnpm --filter @future/web build` passes.
- [ ] `git diff --check` passes.

## V2 Foundation Gates

- [ ] Startup records the `0001_initial` migration exactly once.
- [ ] An existing MVP database opens without losing workspace records.
- [ ] V2 mutations reject missing session tokens and unrelated browser origins.
- [ ] V2 validation rejects unknown request properties.
- [ ] Provider responses expose `hasSecret` but never secret references or values.
- [ ] The browser creates a workspace, provider, and model profile during first run.
- [ ] The connected shell displays persisted workspace and model-profile names.
- [ ] The timeline shows an honest empty state instead of demo events.

## V2 Continuous Assistant Gates

- [ ] The ready shell always exposes one persistent `Message Future` composer.
- [ ] Retrying a create request with the same idempotency input returns one turn
      and writes one `user.message.created` event.
- [ ] Mock and Ollama providers emit incremental chunks through the V2 SSE route.
- [ ] The browser timeline reads persisted SQLite events and advances by cursor
      without duplicating events.
- [ ] Context assembly includes only approved, non-outdated workspace memories,
      matching workspace document chunks, and earlier text-bearing workspace events.
- [ ] Completed answers store citations separately from rendered response text.
- [ ] The context inspector displays the immutable source text, source kind,
      model, token estimate, and redaction count used for the selected answer.
- [ ] Cancelling a queued or active turn records cancellation events and no
      completed assistant response.
- [ ] Provider failure records safe failure events and no raw provider error or
      completed assistant response.
- [ ] Reloading the browser restores persisted user and assistant turns while the
      composer remains available.
- [ ] Playwright completes setup, both assistant turns, citation inspection, and
      reload assertions entirely through browser controls.

## V2 Memory and Hybrid Retrieval Gates

- [ ] Migration `0003_memory_hybrid_retrieval` applies once on clean startup and
      preserves Phase 2 turns, context packs, citations, and events during upgrade.
- [ ] FTS search returns authorized document chunks, approved active memories,
      text-bearing events, and active compactions with stable ordering.
- [ ] Proposed, rejected, outdated, deleted, and cross-workspace memory never
      enters normal retrieval.
- [ ] Noop, Ollama, and OpenAI-compatible embedding adapters validate ordered
      vectors, dimensions, cancellation, and safe errors without secret leakage.
- [ ] Embedding failure completes the turn lexically and persists a safe fallback
      reason in its immutable context pack.
- [ ] Hybrid ranking proves channel fusion, pin/confidence/recency/quality boosts,
      authorization, diversity, hash/range deduplication, and context budgeting.
- [ ] Namespace hierarchy rejects grandchildren and cross-workspace parents.
- [ ] Editing, pinning, review changes, namespace assignment, outdating, and
      deletion create immutable revisions and transactional timeline events.
- [ ] Editing or deleting memory invalidates its embeddings and dependent
      compactions; deleted memory remains an inspectable tombstone but is not listed.
- [ ] The browser Memory lens supports filters, namespace navigation, provenance,
      revision history, optimistic edits, source-linked compaction, and confirmed
      deletion while retaining the persistent composer.
- [ ] Context inspection displays channel scores, final score, ranking reasons,
      compaction provenance, and lexical-only fallback metadata.
- [ ] Playwright proves review, namespace assignment, correction, pinning,
      outdating, changed citations, deletion, and reload durability through browser
      controls only.

## Functional Gates

- [ ] Clean SQLite startup creates the schema from scratch.
- [ ] Web app starts and shows the command center as the first screen.
- [ ] `GET /api/health` returns `{ "ok": true }`.
- [ ] `POST /api/workspaces` creates a workspace and `workspace.created`
      timeline event.
- [ ] `POST /api/imports` imports Markdown fixture content and records
      `import.started`, `document.imported`, and `import.finished`.
- [ ] Imported content is searchable through SQLite FTS5.
- [ ] `POST /api/memories` creates a proposed memory.
- [ ] `POST /api/memories/:id/promote` approves a memory and writes
      `memory.approved`.
- [ ] `PATCH /api/memories/:id` can edit or pin a memory.
- [ ] `DELETE /api/memories/:id` removes a memory and writes `memory.deleted`.
- [ ] `POST /api/context-packs/preview` returns approved memory context.
- [ ] External-model permission requests can be created and decided.
- [ ] Redaction replaces API-key shaped secrets before external model use.
- [ ] `POST /api/commands` with the mock provider records `command.started`,
      `context_pack.created`, `model_call.completed`, and
      `assistant.response.created`.
- [ ] `GET /api/timeline` shows the full audit trail for a workspace.

## Manual Inspection

- [ ] `README.md` links to the design, blueprint, runbook, and checklist.
- [ ] The command center layout has left navigation, top workspace bar, command
      palette, timeline, inspector, and activity strip.
- [ ] Prompt preview UI shows provider, model, context items, and redaction
      count.
- [ ] Permissions UI shows current capability states.
- [ ] No generated folders such as `.future/`, `node_modules/`, `test-results/`,
      or `playwright-report/` are tracked.
