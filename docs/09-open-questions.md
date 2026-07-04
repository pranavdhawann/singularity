# Resolved and Deferred Decisions

The earlier product and technical questions are resolved for the first build by
the end-to-end design and implementation blueprint:

- [End-to-End Design](superpowers/specs/2026-07-04-future-end-to-end-design.md)
- [Implementation Blueprint](superpowers/plans/2026-07-04-future-mvp-implementation-blueprint.md)

## Resolved for MVP

- Product name: Future.
- First release audience: developers and power users, with a developer
  workspace as the first demo because it exercises imports, memory, retrieval,
  permissions, and provider routing.
- App shell: plain local web app first, desktop wrapper later.
- Backend: TypeScript Node local API.
- Frontend: TypeScript React with Vite.
- Storage: SQLite as local source of truth, SQLite FTS5 for lexical search, and
  a replaceable vector-search adapter.
- Provider routing: small custom provider interface with mock,
  OpenAI-compatible, and Ollama-compatible adapters first.
- MCP support: deferred until the plugin boundary exists.
- Memory promotion: review is required for personal facts, procedures,
  credential-like text, low-confidence memories, and memories from imported
  third-party chats.
- Prompt preview: required by default before external model calls.
- Privacy-sensitive workspaces: can be configured as local-model-only.
- Background tasks: denied in MVP except foreground import/indexing jobs.
- Core integrations: imports and providers stay in core; broad connectors such
  as email, calendar, Slack, Discord, Telegram, WhatsApp, phone calls, and web
  automation are plugin candidates.

## Deferred Beyond MVP

- Packaged desktop wrapper choice between Tauri and Electron.
- Hosted sync.
- Team workspaces.
- Plugin marketplace.
- Smart cost-based model routing.
- Graph memory beyond source-linked records.
- Autonomous background agents.
- Open-source contribution process beyond the existing MIT license.
