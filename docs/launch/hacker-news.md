# Hacker News draft

**Title:** Show HN: Singularity – a local memory and permission layer for AI assistants

I built Singularity because useful assistant context is usually trapped in disposable chats and external model calls are difficult to inspect.

Singularity imports ChatGPT history and project files into local SQLite, retrieves source-backed context, and keeps citations separate from generated text. It works with Ollama and OpenAI-compatible endpoints. Before an external call, it renders and redacts the complete prompt locally and requires approval of an immutable preview bound to the provider, model, context, and prompt hashes.

The repository includes a deterministic offline demo, tests for import recovery and approve/deny paths, and no cloud account. It is an early functional release rather than a production-ready app; packaging and encrypted storage are still open work.

Repo: https://github.com/pranavdhawann/singularity

I would value feedback on the privacy boundary, retrieval inspection, and whether the first import-to-citation path is understandable.
