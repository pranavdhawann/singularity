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

This repository currently contains the product concept, research notes, v1
scope, architecture direction, and roadmap. It is intentionally docs-first.

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
- [Open Questions](docs/09-open-questions.md)
- [References](docs/references.md)
- [Design Spec](docs/superpowers/specs/2026-07-03-memory-first-assistant-ide-design.md)

## License

MIT
