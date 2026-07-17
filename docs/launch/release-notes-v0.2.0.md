# Singularity v0.2.0

The v2 release: chat-first UI, always-on redaction, remembering memory.

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
