# Repository Cleanup and Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove superseded documentation and disposable local output while leaving a concise, accurate explanation of Future and its remaining work.

**Architecture:** Keep the canonical V2 design and operational docs as the source of truth. Replace the root README with a current product and repository guide, refine the existing Phase 4/5 roadmap without discarding user-authored content, then delete historical artifacts only after removing their references.

**Tech Stack:** Markdown, Git, PowerShell, pnpm, TypeScript, Vitest, Vite, Playwright

## Global Constraints

- Preserve all application source, tests, migrations, operational runbooks, release checks, license, and repository configuration.
- Preserve the current content of the pre-existing `docs/12-next-steps.md` working-tree modification and edit it in place.
- Keep `node_modules/` and `.worktrees/`; either may contain active local state.
- Do not add product functionality or alter runtime behavior.
- The canonical detailed design remains `docs/superpowers/specs/2026-07-10-future-v2-continuous-assistant-design.md`.

---

### Task 1: Consolidate Current Documentation

**Files:**

- Modify: `README.md`
- Modify: `docs/context.md`
- Modify: `docs/12-next-steps.md`

**Interfaces:**

- Consumes: implemented Phase 3 behavior described by the canonical V2 design and current source tree
- Produces: a root product guide, contributor orientation, and ordered remaining-work roadmap

- [ ] **Step 1: Rewrite the README around current truth**

Include these exact sections: `What Future Is`, `What Works Today`, `How It Works`, `Privacy Model`, `Repository Layout`, `Run Locally`, `Verification`, `What Is Left`, `Documentation`, and `License`. State explicitly that Phase 3 is complete and link Phase 4/5 work to `docs/12-next-steps.md`.

- [ ] **Step 2: Remove branch-specific drift from contributor context**

Replace the branch-state wording with `Current Implementation` and retain the Phase 3 capability list, architecture map, verification commands, assistant flow, and Phase 4 boundary.

- [ ] **Step 3: Refine the remaining-work roadmap**

Retain the existing Phase 4 and Phase 5 requirements, add a short status legend separating complete/current/deferred work, and ensure each incomplete phase has a measurable browser-facing acceptance gate.

- [ ] **Step 4: Check documentation changes**

Run:

```powershell
git diff --check -- README.md docs/context.md docs/12-next-steps.md
```

Expected: exit code 0 with no whitespace errors.

### Task 2: Remove Superseded Documentation and Disposable Output

**Files:**

- Delete: `docs/00-vision.md`
- Delete: `docs/01-market-research.md`
- Delete: `docs/02-product-principles.md`
- Delete: `docs/03-v1-scope.md`
- Delete: `docs/04-interface.md`
- Delete: `docs/05-memory-architecture.md`
- Delete: `docs/06-model-routing.md`
- Delete: `docs/07-permissions-privacy.md`
- Delete: `docs/08-roadmap.md`
- Delete: `docs/09-open-questions.md`
- Delete: `docs/superpowers/specs/2026-07-03-memory-first-assistant-ide-design.md`
- Delete: `docs/superpowers/specs/2026-07-04-future-end-to-end-design.md`
- Delete: `docs/superpowers/specs/2026-07-11-future-v2-phase-3-memory-hybrid-retrieval-design.md`
- Delete: `docs/superpowers/plans/2026-07-04-future-mvp-implementation-blueprint.md`
- Delete: `docs/superpowers/plans/2026-07-10-future-v2-phase-1-foundation-connected-shell.md`
- Delete: `docs/superpowers/plans/2026-07-10-future-v2-phase-2-continuous-assistant-vertical-slice.md`
- Delete: `docs/superpowers/plans/2026-07-11-future-v2-phase-3-memory-hybrid-retrieval.md`
- Remove locally: `.future/`
- Remove locally: `test-results/`

**Interfaces:**

- Consumes: the updated canonical-document links from Task 1
- Produces: a smaller repository with no tracked references to deleted documents

- [ ] **Step 1: Search for references before deletion**

Run `rg -n` for every candidate basename across tracked Markdown. Any active reference must be removed or redirected before its target is deleted.

- [ ] **Step 2: Delete superseded tracked documents**

Use a single reviewed patch so Git records only the files listed above as deleted.

- [ ] **Step 3: Delete reproducible ignored output**

Resolve `.future/` and `test-results/` to absolute paths under the repository root, verify both paths, then remove them with native PowerShell. Do not remove `node_modules/` or `.worktrees/`.

- [ ] **Step 4: Validate links and repository scope**

Run a local Markdown-link checker that inspects relative links in every tracked or newly added `.md` file and fails on missing targets. Then inspect `git status --short` and confirm no application code changed.

### Task 3: Full Verification

**Files:**

- Verify: entire workspace

**Interfaces:**

- Consumes: consolidated documentation and unchanged application source
- Produces: fresh evidence that cleanup did not break the repository

- [ ] **Step 1: Run workspace checks**

```powershell
corepack pnpm check
```

Expected: all workspace typechecks, lint commands, and Vitest suites pass.

- [ ] **Step 2: Build the web application**

```powershell
corepack pnpm --filter @future/web build
```

Expected: Vite exits 0 and writes the production bundle.

- [ ] **Step 3: Run browser coverage**

```powershell
corepack pnpm test:e2e
```

Expected: all Playwright tests pass.

- [ ] **Step 4: Run final repository checks**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; status contains only the intended documentation modifications/deletions and the implementation plan.
