# Contributor Roadmap

## Find your lane

- **UI and accessibility:** `apps/web/src`, with colocated Vitest/Testing Library tests.
- **API behavior:** `apps/api/src/routes` and `apps/api/src/services`, with colocated Fastify/Vitest tests.
- **Persistence:** `packages/db/src`; add ordered migrations and repository tests without rewriting applied migrations.
- **Imports and retrieval:** `packages/importers` and `packages/retrieval`; keep tests offline and deterministic.
- **Privacy and model adapters:** `packages/permissions` and `packages/providers`; safe errors and secret non-persistence are required invariants.
- **Browser journeys:** `tests/e2e`; tests run against in-memory SQLite and local deterministic providers.
- **Documentation:** README and `docs`; verify commands and relative links before submitting.

## Good first contribution

1. Pick a labeled issue with acceptance criteria and likely files.
2. Comment that you are working on it so effort is not duplicated.
3. Create a focused branch and add or update the smallest relevant test first.
4. Run the focused test, then `corepack pnpm check`.
5. For browser behavior, also run `corepack pnpm test:e2e`.
6. Open a pull request using the template and include screenshots for visible changes.

Avoid parallel chat systems, unreviewed schema rewrites, raw provider logging, stored secret values, and any path that bypasses prompt approval. Those changes conflict with the architecture even when they appear convenient.

## Maintainer-sized work

The next deeper areas are structured redacted local logging, visible bounded job recovery, opt-in proactive summaries disabled by default, packaging, and setup diagnostics. Each needs a written design before implementation because it touches privacy or durable state.
