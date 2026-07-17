# Hacker News draft

**Title:** Show HN: Singularity – local memory and a permission gate for AI assistants

I built Singularity because useful assistant context is usually trapped in disposable chats, and it's hard to know exactly what an external model call sends.

Singularity imports ChatGPT history and project files into local SQLite, retrieves cited, source-backed context, and keeps citations separate from generated text. It works offline, with Ollama, or with any OpenAI-compatible endpoint. Before an external call, it redacts the complete prompt locally (always-on PII redaction, with a live per-turn redaction count) and pauses for approval of an immutable preview bound to the provider, model, context, and prompt hashes. Provider secrets live in an AES-256-GCM encrypted local store; retrieval combines SQLite FTS5 with a sqlite-vec KNN index.

You can try the deterministic offline demo with one Docker command or a local pnpm install — no cloud account. It's an early v0.2.0 for technical adopters: no desktop packaging yet, and the SQLite timeline itself is not encrypted at rest.

Repo: https://github.com/pranavdhawann/singularity

I'd value feedback on the privacy boundary, the retrieval inspection UX, and whether the import-to-cited-answer path is understandable.
