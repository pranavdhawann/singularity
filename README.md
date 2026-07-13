# Future

Future is a local, model-agnostic, memory-first continuous assistant. It keeps
one durable assistant relationship across projects, files, imported sources,
decisions, and tasks instead of splitting context across disposable chat threads.

## What Future Is

Future is a local command center for working with AI models while keeping the
assistant's history, memory, retrieval, and permissions inspectable. Models are
replaceable infrastructure: the user chooses a local Ollama model or a configured
external provider without handing ownership of the assistant relationship to one
vendor.

The product is built around four ideas:

- one persistent timeline for user requests, model responses, imports, failures,
  cancellations, and system actions;
- source-backed memory that can be reviewed, edited, pinned, outdated, or deleted;
- visible context selection, citations, model calls, and permission decisions;
- local-first storage with explicit approval before sensitive context leaves the
  machine.

## What Works Today

Phase 4, Imports and External Models, is complete. The current application has:

- a React command center with first-run setup, workspace switching, a persistent
  composer, timeline polling, and streamed assistant responses;
- a Fastify API protected by a local session token and origin checks;
- a SQLite event store with ordered, checksum-verified migrations;
- mock, Ollama, and OpenAI-compatible text-generation profiles with persisted
  model selection and call-time `env:` secret resolution;
- idempotent assistant turns with durable completion, cancellation, and failure
  outcomes;
- lexical and optional embedding retrieval across document chunks, approved
  memories, events, and compactions;
- immutable context packs with source citations and ranking explanations;
- browser memory review, editing, pinning, lifecycle controls, and namespaces;
- protected multipart Markdown, text, and ChatGPT imports with persisted,
  resumable indexing checkpoints and per-file retry;
- whole-prompt redaction across instructions, user text, and retrieved sources;
- immutable external prompt previews and decisions bound to the exact turn,
  provider, model, context pack, and final redacted prompt;
- external SSE streaming and cancellation through the existing assistant turn;
- explicit permissions, source ranges, redaction metadata, and context inspection;
- unit, integration, build, and Playwright hero-flow coverage.

Legacy `/api` routes remain during migration, while the connected browser uses
the protected `/api/v2` contracts.

## How It Works

1. The browser creates an idempotent assistant turn for the active workspace.
2. The API stores the user event before calling a model.
3. Retrieval ranks approved memories, imported chunks, recent events, and active
   compactions, then stores the selected material as an immutable context pack.
4. The selected provider streams a response through the protected SSE endpoint.
5. The API stores the terminal answer, failure, or cancellation and attaches
   normalized citations separately from response text.
6. The browser refreshes the durable timeline and can inspect the exact sources
   used for the turn.

## Privacy Model

Application data is stored locally in SQLite. Local mock and Ollama flows can run
without sending context to an external model. Permissions and redaction are
explicit product boundaries, not hidden provider settings.

External calls fail closed unless whole-prompt redaction succeeds and the user
approves an immutable preview bound to the final provider, model, context pack,
and redacted prompt. Resolved secrets, pre-redaction prompts, imported content,
and external response bodies are excluded from timeline and failure payloads.

## Repository Layout

- `apps/api` — Fastify orchestration and local HTTP boundary
- `apps/web` — React command center and setup experience
- `packages/core` — shared contracts and pure domain types
- `packages/db` — SQLite migrations, connection, and repositories
- `packages/importers` — normalized Markdown, text, and ChatGPT parsing
- `packages/memory` — memory extraction, review, and state transitions
- `packages/retrieval` — lexical, embedding, hybrid-ranking, and context-pack logic
- `packages/providers` — mock, Ollama, and OpenAI-compatible adapters
- `packages/permissions` — policy evaluation and redaction
- `tests/e2e` — browser hero-flow coverage

## Run Locally

Requirements: a current Node.js release with Corepack and the pinned pnpm version
from `package.json`.

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

The web app and API start together. See the [build runbook](docs/10-build-runbook.md)
for ports, environment configuration, and troubleshooting.

## Verification

```powershell
corepack pnpm check
corepack pnpm --filter @future/web build
corepack pnpm test:e2e
git diff --check
```

Playwright requires its pinned Chromium build:

```powershell
corepack pnpm exec playwright install chromium
```

## What Is Left

The next release boundary is Phase 5: opt-in proactive assistance, job controls,
operational hardening, real linting, CI, and contributor/security documentation.

The ordered requirements and acceptance gates live in
[Next Steps](docs/12-next-steps.md).

## Documentation

- [Current architecture and product design](docs/superpowers/specs/2026-07-10-future-v2-continuous-assistant-design.md)
- [Contributor and agent context](docs/context.md)
- [Build runbook](docs/10-build-runbook.md)
- [Release checklist](docs/11-release-checklist.md)
- [Remaining work](docs/12-next-steps.md)
- [Research references](docs/references.md)

## License

MIT
