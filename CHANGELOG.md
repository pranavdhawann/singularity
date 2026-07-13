# Changelog

All notable user-visible changes to Singularity are documented here. The project follows semantic versioning beginning with the early `0.x` line.

## [Unreleased]

### Added

- safer Windows demo shutdown, explicit seeded-demo reset, and startup prerequisite diagnostics;
- deterministic repository Markdown link checking in CI;
- an isolated migration smoke command and a synthetic-data external-provider privacy checklist.

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

[Unreleased]: https://github.com/pranavdhawann/singularity/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pranavdhawann/singularity/releases/tag/v0.1.0
