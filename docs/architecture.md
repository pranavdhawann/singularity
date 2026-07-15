# Architecture

Singularity is a local web application with a React browser client, a Fastify API, and SQLite persistence. The browser uses protected HTTP and SSE contracts; it never opens the database directly.

## Request flow

1. The browser creates an idempotent assistant turn for a workspace and model profile.
2. The API stores the user event before model execution.
3. Retrieval searches authorized document chunks, approved active memory, earlier events, and active compactions.
4. Ranking applies lexical and optional vector channels, diversity, deduplication, source quality, recency, pinning, confidence, and a context budget.
5. Singularity stores the selected evidence as an immutable context pack with citations and source ranges.
6. Local profiles stream immediately. External profiles render and redact the full prompt, persist an immutable preview, and pause for an approve/deny decision.
7. The terminal answer, failure, denial, or cancellation is committed before the final SSE frame.

## Package map

- `apps/web`: React setup, timeline, composer, imports, memory, prompt preview, and source inspector.
- `apps/api`: Fastify routes, orchestration services, session/origin enforcement, and SSE lifecycle.
- `packages/core`: shared API contracts, domain types, event types, and identifiers.
- `packages/db`: ordered migrations, SQLite connection, and repositories.
- `packages/importers`: ChatGPT, Markdown, and text normalization plus chunking.
- `packages/retrieval`: lexical search, optional embedding adapters, hybrid ranking, and context budgets.
- `packages/memory`: extraction, review, and lifecycle state transitions.
- `packages/providers`: mock, Ollama, and OpenAI-compatible streaming adapters.
- `packages/permissions`: policy evaluation, prompt rendering, and redaction.
- `tests/e2e`: browser acceptance paths and deterministic local external-provider fixture.

## Durable invariants

- user input is persisted before provider execution;
- completed answers cite separately stored immutable source references;
- deleted/outdated/rejected memory is excluded from normal retrieval;
- secrets are resolved from environment references only at call time;
- external calls fail closed if redaction or grant validation fails;
- approval binds to exact provider, model, context, and prompt hashes;
- safe error codes reach the timeline; raw provider errors and response bodies do not.

## Optional ML redaction (GLiNER)

Redaction ships regex-only by default. The engine also has a GLiNER-backed ML
recognizer in its `MlRecognizer` slot (`packages/permissions/src/gliner.ts`),
which detects entities regex cannot (person names, addresses, unusual PII).

It stays dormant unless a model is configured via `FUTURE_GLINER_MODEL` (a path
to a GLiNER ONNX model). Activation also needs the optional `onnxruntime-node`
runtime and a model-specific `<model>.adapter.mjs` exporting `encode`/`decode`;
neither is a declared dependency, so the default build and CI stay lean. If any
piece is missing the recognizer reports `available: false` and redaction remains
regex-only. The recognizer's span→entity mapping, thresholding, and risk tagging
are covered by unit tests with an injected session.

> Enabling GLiNER inside the always-on external-turn flow additionally requires
> rendering the approval preview through the same async engine, so the exact
> masked prompt the user approves matches what the risk gate detected.

See the [V2 design](superpowers/specs/2026-07-10-future-v2-continuous-assistant-design.md) for the complete product contract.
