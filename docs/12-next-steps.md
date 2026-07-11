# Next Steps

This document turns the remaining sequence in the original Future product design
and the approved V2 continuous-assistant design into the next executable roadmap.
Phase 3 is complete. New work must extend the existing event, assistant-turn,
source, memory, retrieval, context-pack, provider, and permission contracts rather
than introduce parallel chat or retrieval flows.

## Immediate Priority: Phase 4, Imports and External Models

Phase 4 completes the real source-ingestion and external-model path.

### 1. Browser imports

- add protected multipart upload routes for Markdown, text, and ChatGPT exports
- connect browser file selection, progress, partial failure, and retry states
- preserve normalized documents and completed chunks when one file fails
- expose imported documents and source ranges in the existing source inspector

### 2. Resumable indexing jobs

- move parsing, chunking, FTS synchronization, and optional embedding generation
  behind persisted jobs
- record checkpoints so interrupted imports resume without duplicate documents,
  chunks, embeddings, or timeline events
- add explicit retry controls and safe index-failure diagnostics

### 3. OpenAI-compatible text runtime

- resolve persisted provider profiles and `env:` secret references at call time
- support streaming responses and cancellation through the existing assistant-turn
  SSE lifecycle
- keep endpoint response bodies, secrets, and raw outbound prompts out of logs and
  timeline payloads

### 4. Whole-prompt privacy enforcement

- classify and redact the complete outbound prompt after retrieval, including
  memory, document, event, compaction, system, and user text
- block external execution if redaction fails
- persist only safe redaction counts and immutable context metadata

### 5. Immutable prompt-preview grants

- show provider, endpoint classification, model, instructions, selected sources,
  privacy labels, estimated tokens, redactions, and exclusions
- bind approval to the turn ID, provider, model, context-pack hash, and final prompt
- invalidate approval when any bound input changes
- preserve denial and retry as auditable timeline outcomes

## Phase 4 Acceptance Gate

A fresh browser session must be able to import a real file and ChatGPT export,
resume an interrupted index job, retrieve the imported sources, preview the exact
redacted prompt for an external OpenAI-compatible profile, approve it, receive a
streamed cited answer, and inspect the immutable source, permission, model, and
redaction records used. Mock and Ollama flows must remain fully offline-capable.

Required verification remains:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm --filter @future/web build
corepack pnpm test:e2e
git diff --check
```

## Following Priority: Phase 5, Proactive Assistance and Hardening

After Phase 4 is complete:

- add opt-in reminders and scheduled workspace/review summaries
- add browser notifications, job controls, bounded retries, and visible blocked jobs
- add structured redacted local logging and failure-recovery controls
- replace the current TypeScript-only lint placeholder with real lint and formatting
- add CI that runs the same frozen install, checks, build, migrations, and pinned
  Chromium flows as local verification
- document contribution, security, architecture, migration, and release procedures

Phase 5 is complete only when proactive work is disabled by default, every job is
permission-bound and auditable, repeated failures stop visibly, and clean-install
verification passes locally and in CI.

## Deferred Until V2 Is Complete

Keep these out of Phase 4 and Phase 5 unless a prerequisite contract requires a
narrow extension:

- desktop packaging
- cloud sync or hosted accounts
- multi-user and team workspaces
- broad email, calendar, messaging, or phone connectors
- untrusted in-process plugins or a marketplace
- autonomous external actions without explicit permission
- automatic cost routing across providers

The next planning artifact should be a dedicated Phase 4 design and test-driven
implementation plan grounded in this document and the V2 design acceptance criteria.
