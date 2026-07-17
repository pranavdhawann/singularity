# Changelog

All notable user-visible changes to Singularity are documented here. The project follows semantic versioning beginning with the early `0.x` line.

## [Unreleased]

_Nothing yet._

## [0.2.0] - 2026-07-17

### Added

- chat-first single-assistant shell with a settings drawer and a single implicit workspace;
- automatic capture of salient memory facts on turn completion, deduplicated against existing memory, with per-workspace settings;
- always-on PII redaction for external prompts and a live per-turn redaction badge streamed over SSE;
- encrypted-at-rest local secret store (AES-256-GCM) for provider secrets;
- sqlite-vec KNN vector index backing embedding retrieval;
- optional GLiNER ML redaction recognizer slot (dormant unless `FUTURE_GLINER_MODEL` is configured);
- OpenAI-compatible connection test during setup;
- safer Windows demo shutdown, explicit seeded-demo reset, and startup prerequisite diagnostics;
- an isolated migration smoke command, repository Markdown link checking in CI, and a synthetic-data external-provider privacy checklist;
- focus-trapped external-approval dialog and screen-reader import announcements.

### Changed

- the connected browser now uses protected `/api/v2` contracts; legacy `/api` routes remain during migration.

### Known limitations

- no desktop package; provider secrets are encrypted but the SQLite timeline is not encrypted at rest;
- the local OS account remains the trust boundary.

## [0.1.0] - 2026-07-13

### Added

- local first-run setup with mock, Ollama, and OpenAI-compatible profiles;
- durable assistant timeline, streamed turns, cancellations, safe failures, citations, and context inspection;
- reviewed memory lifecycle, namespaces, revisions, compactions, tombstones, FTS5, and optional embeddings;
- resumable Markdown, text, and ChatGPT export imports;
- whole-prompt redaction plus immutable external prompt approval and denial;
- deterministic offline demo command and browser acceptance coverage;
- ESLint, Prettier, frozen-install GitHub Actions, contributor documentation, templates, and launch assets.

### Known limitations

- no desktop package, encrypted local database, cloud sync, teams, or broad connectors;
- local OS account is the trust boundary;
- proactive assistance and bounded job controls are not yet implemented;
- legacy `/api` routes remain during V2 migration.

[Unreleased]: https://github.com/pranavdhawann/singularity/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/pranavdhawann/singularity/releases/tag/v0.2.0
[0.1.0]: https://github.com/pranavdhawann/singularity/releases/tag/v0.1.0
