# Reddit draft (r/LocalLLaMA first, then r/selfhosted)

**Title:** I built a local-first assistant that cites your imported ChatGPT history and shows you the exact redacted prompt before any external call

Singularity is an open-source local memory and permission layer for AI assistants. Import ChatGPT exports, Markdown, or text; retrieve across them with citations and inspectable source ranges; run fully offline, against Ollama, or against any OpenAI-compatible provider.

For external providers it builds and redacts the full prompt locally (always-on PII redaction with a live redaction badge), then pauses until you approve or deny the exact preview — the approval is bound to the provider, model, selected context, and prompt hashes. Secrets sit in an encrypted local store; retrieval is SQLite FTS5 plus a sqlite-vec KNN vector index.

v0.2.0 is for technical early adopters. One-command Docker demo or a pnpm install; local SQLite; no cloud account. No desktop packaging yet, and the timeline database is not encrypted at rest.

Repo and quick start: https://github.com/pranavdhawann/singularity

Looking for honest install reports and feedback on citation quality, Ollama setup, and the prompt approval UI — not star farming.
