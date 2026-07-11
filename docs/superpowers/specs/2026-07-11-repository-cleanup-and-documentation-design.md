# Repository Cleanup and Documentation Design

## Goal

Reduce Future's repository documentation to a small set of current sources of
truth, remove disposable local output, and make the root README and remaining-work
roadmap accurately describe the Phase 3 application.

## Cleanup Boundary

Remove completed implementation plans and superseded product/design documents
only after their active references are removed or redirected. Preserve source
code, tests, migrations, the canonical V2 continuous-assistant design, operational
runbooks, release checks, licensing, and repository configuration.

Delete ignored runtime and test artifacts that are safe to recreate. Do not
delete dependency installations or Git worktrees because either may contain
active local work. Do not modify or commit unrelated user changes.

## Canonical Documentation

The maintained documentation set will be:

- `README.md`: product explanation, implemented capabilities, architecture,
  privacy model, development commands, current status, and document index.
- `docs/context.md`: concise contributor and agent orientation.
- `docs/10-build-runbook.md`: local development and verification procedures.
- `docs/11-release-checklist.md`: release-readiness gates.
- `docs/12-next-steps.md`: ordered incomplete work and acceptance criteria.
- `docs/references.md`: external research and attribution still needed by the
  canonical V2 design.
- `docs/superpowers/specs/2026-07-10-future-v2-continuous-assistant-design.md`:
  detailed product and architecture source of truth.
- this cleanup design: audit trail for the consolidation decision.

## README Content

The README will describe Future as a local, model-agnostic, memory-first
continuous assistant organized around one durable timeline rather than isolated
chat threads. It will distinguish implemented Phase 3 behavior from planned
Phase 4 and Phase 5 work, summarize the monorepo packages, explain local-first
privacy and explicit external-model approval, and provide exact setup and
verification commands.

## Remaining Work

`docs/12-next-steps.md` will remain the canonical roadmap. It will enumerate:

1. Phase 4 browser imports and resumable indexing.
2. Persisted OpenAI-compatible text generation.
3. Whole-prompt privacy enforcement and immutable preview grants.
4. Phase 5 opt-in proactive assistance, operational hardening, real linting,
   continuous integration, and contributor/security documentation.
5. Post-V2 deferred work such as desktop packaging, sync, teams, connectors,
   plugins, and automatic provider-cost routing.

Each phase will retain a browser-observable acceptance gate and the repository's
full verification command set.

## Safety and Verification

Before deletion, search the repository for links to every candidate document.
After editing, verify that all relative Markdown links resolve, inspect Git status
to confirm only intended files changed, run `git diff --check`, and run the full
repository gates:

```powershell
corepack pnpm check
corepack pnpm --filter @future/web build
corepack pnpm test:e2e
```

If a gate fails for an environment reason, report the exact command and failure
without claiming completion.
