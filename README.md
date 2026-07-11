# Future

Future is a local, model-agnostic assistant IDE for power users and developers.

It is not another chat app. The core product is a command center with a unified
timeline, durable memory, explicit permissions, and bring-your-own model
providers. Users can connect OpenAI, Anthropic, Google, OpenRouter, Ollama,
LM Studio, or any OpenAI-compatible endpoint while keeping their history,
memory, and permissions under local control.

## Core Idea

Future helps a user maintain one long-running assistant relationship across
projects, files, chats, notes, decisions, and tasks.

The assistant can:

- remember past work through local event history, summaries, facts, and labels
- retrieve relevant context before answering or acting
- route requests to different models and providers
- show what it is allowed to read, write, run, call, or connect to
- ask for help when it lacks enough context or permission
- keep a complete timeline of conversations, imports, compactions, decisions,
  and actions

## Positioning

Future sits between:

- local AI assistants such as OpenClaw, Open WebUI, AnythingLLM, Jan, and LibreChat
- developer AI tools such as Continue, OpenHands, Aider, Cursor, Codex, and Claude Code
- memory layers such as Mem0, Letta, Zep, and LangGraph memory stores

The wedge is a memory-first local command center. Chat is a source of context,
not the primary interface.

## Repository Status

This repository contains the product concept, research notes, v1 scope,
architecture direction, roadmap, end-to-end design, implementation blueprint,
and the first local MVP scaffold. The current implementation is a TypeScript
monorepo with a local API, React command center, SQLite event store, imports,
memory review, provider abstraction, permissions, context packs, and Playwright
hero-flow coverage.

The continuous-assistant architecture has completed Phase 3: connected setup and
streaming, one persistent timeline and composer, hybrid source-backed retrieval,
memory namespaces and revisions, optional embeddings, compaction, and a connected
browser memory-management flow. Phase 4 is imports and external-model privacy.

## Docs

- [Vision](docs/00-vision.md)
- [Market Research](docs/01-market-research.md)
- [Product Principles](docs/02-product-principles.md)
- [V1 Scope](docs/03-v1-scope.md)
- [Interface](docs/04-interface.md)
- [Memory Architecture](docs/05-memory-architecture.md)
- [Model Routing](docs/06-model-routing.md)
- [Permissions and Privacy](docs/07-permissions-privacy.md)
- [Roadmap](docs/08-roadmap.md)
- [Resolved and Deferred Decisions](docs/09-open-questions.md)
- [References](docs/references.md)
- [Build Runbook](docs/10-build-runbook.md)
- [Release Checklist](docs/11-release-checklist.md)
- [Next Steps](docs/12-next-steps.md)
- [Initial Design Spec](docs/superpowers/specs/2026-07-03-memory-first-assistant-ide-design.md)
- [Canonical End-to-End Design](docs/superpowers/specs/2026-07-04-future-end-to-end-design.md)
- [V2 Continuous Assistant Design](docs/superpowers/specs/2026-07-10-future-v2-continuous-assistant-design.md)
- [V2 Phase 1 Plan](docs/superpowers/plans/2026-07-10-future-v2-phase-1-foundation-connected-shell.md)
- [Agent Context](docs/context.md)
- [MVP Implementation Blueprint](docs/superpowers/plans/2026-07-04-future-mvp-implementation-blueprint.md)

## Local Development

```powershell
corepack pnpm install
corepack pnpm dev
```

Verification:

```powershell
corepack pnpm check
corepack pnpm test:e2e
```

## License

MIT
