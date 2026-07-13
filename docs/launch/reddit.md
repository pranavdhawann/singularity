# Reddit draft

**Title:** I built a local-first assistant that cites imported ChatGPT history and asks before external calls

Singularity is an open-source local memory and permission layer for AI assistants. You can import ChatGPT exports, Markdown, or text; retrieve across them with citations; inspect the exact source ranges; and use an offline mock, Ollama, or an OpenAI-compatible provider.

For external providers, Singularity builds and redacts the full prompt locally, then pauses until you approve or deny the exact preview. The approval is bound to the provider, model, selected context, and final prompt hashes.

The current `v0.1.0` is for technical early adopters. It uses local SQLite and has a one-command seeded demo after install, but it does not yet have desktop packaging or encrypted storage.

Repo and quick start: https://github.com/pranavdhawann/singularity

I am looking for honest install reports and feedback on citation quality, Ollama setup, and the prompt approval UI—not star farming.
