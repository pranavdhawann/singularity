# Future Launch Readiness v0.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Phase 4 into an honest, reproducible, contributor-ready `v0.1.0` launch without expanding Future beyond its local memory and permission layer.

**Architecture:** Preserve the existing React/Fastify/SQLite application and add an idempotent demo launcher around its protected APIs. Add repository-wide static quality gates, public project documentation, browser acceptance coverage, and GitHub community/release metadata without changing privacy contracts.

**Tech Stack:** Node.js 24, pnpm 11.9.0, TypeScript 6, React 19, Fastify 5, SQLite, Vitest, Playwright, ESLint, Prettier, GitHub Actions.

## Global Constraints

- Product name is `Future`; repository name remains `singularity`.
- Public promise: “Future is the local memory and permission layer for AI assistants—import your history, retrieve cited context, and approve exactly what leaves your machine.”
- No autonomous external actions, cloud accounts, team features, or broad integrations.
- External calls continue to fail closed behind whole-prompt redaction and immutable explicit approval.
- Release language says early and functional, not production-ready.
- Preserve user changes, never force-push, and push only after every required gate passes.

---

### Task 1: Real linting, formatting, and CI

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: workspace `package.json` files to remove TypeScript-only lint placeholders
- Create: `eslint.config.js`
- Create: `.prettierignore`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces root commands `lint`, `format`, `format:check`, and `check` used locally and in CI.

- [ ] Install pinned ESLint, TypeScript-ESLint, React lint plugins, globals, and Prettier at the workspace root.
- [ ] Configure ESLint for Node, browser, TypeScript, React hooks, tests, and generated-directory ignores.
- [ ] Configure Prettier and format changed files; make `check` include `format:check`.
- [ ] Add CI jobs for frozen install, typecheck/lint/format/tests/build, Chromium install, and E2E.
- [ ] Run lint and formatting gates and fix every reported repository issue.
- [ ] Commit as `build: add launch quality gates and ci`.

### Task 2: Deterministic demo and first-run acceptance

**Files:**
- Create: `scripts/demo.mjs`
- Create: `scripts/demo.test.ts`
- Create: `examples/future-demo.md`
- Modify: `package.json`
- Modify: `tests/e2e/phase4.spec.ts`
- Create: `tests/e2e/first-run.spec.ts`

**Interfaces:**
- Produces `corepack pnpm demo`, which starts the app and idempotently seeds an offline workspace through protected APIs.

- [ ] Write failing tests for empty-database seeding, idempotent reruns, protected request headers, and bundled source upload.
- [ ] Run the focused demo tests and confirm they fail because the launcher functions do not exist.
- [ ] Implement the minimal exported seed functions and attached dev-process launcher.
- [ ] Run focused tests to green, then add the demo test to the root test command.
- [ ] Add a browser test that performs visible first-run setup, imports Markdown, asks a question, and opens cited source context.
- [ ] Extend external-provider coverage to prove denial records an auditable decision and never calls the provider.
- [ ] Run focused unit and Playwright tests.
- [ ] Commit as `feat: add deterministic first-run demo`.

### Task 3: Public repository documentation and launch assets

**Files:**
- Rewrite: `README.md`
- Modify: `docs/context.md`
- Modify: `docs/10-build-runbook.md`
- Modify: `docs/11-release-checklist.md`
- Modify: `docs/12-next-steps.md`
- Create: `docs/architecture.md`
- Create: `docs/contributor-roadmap.md`
- Create: `docs/releasing.md`
- Create: `docs/assets/future-demo.png`
- Create: `docs/launch/announcement.md`
- Create: `docs/launch/hacker-news.md`
- Create: `docs/launch/reddit.md`
- Create: `docs/launch/social.md`
- Create: `docs/launch/demo-script.md`
- Create: `docs/launch/faq.md`
- Create: `docs/launch/positioning.md`
- Create: `docs/launch/github-topics.md`

**Interfaces:**
- README commands must exactly match package scripts and documented environment variables.

- [ ] Rewrite the README around the approved promise, wedge, 60-second demo, Ollama path, external-provider path, exact current capabilities, privacy, architecture, roadmap, naming relationship, and contribution links.
- [ ] Capture a local screenshot from the deterministic demo and embed it in the README.
- [ ] Add contributor structure, architecture, reproducible release, and launch documents with honest claims and activation-oriented metrics.
- [ ] Update canonical context, runbook, checklist, and roadmap to mark only the Phase 5 foundations completed here.
- [ ] Validate every relative Markdown link and every documented command.
- [ ] Commit as `docs: prepare Future for early launch`.

### Task 4: Community health and release metadata

**Files:**
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `CHANGELOG.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**
- Security reporting uses GitHub private vulnerability reporting and never asks reporters to publish sensitive details.

- [ ] Add scoped security, contribution, conduct, changelog, issue, and pull-request documents.
- [ ] Cross-link them from README and contributor roadmap.
- [ ] Validate issue-form YAML and required fields.
- [ ] Commit as `docs: add contributor and release foundations`.

### Task 5: Verification, GitHub setup, issues, and v0.1.0

**Files:**
- Inspect every changed file and all generated/tracked-file lists.
- Update GitHub description, topics, labels, issues, branch, tag, and release after local gates pass.

**Interfaces:**
- Produces branch `codex/launch-readiness-v0.1.0`, tag/release `v0.1.0`, and 10–15 actionable issues.

- [ ] Run `corepack pnpm install --frozen-lockfile`.
- [ ] Run `corepack pnpm check`.
- [ ] Run `corepack pnpm --filter @future/web build`.
- [ ] Run `corepack pnpm test:e2e`.
- [ ] Run `git diff --check` and validate workflow/issue YAML.
- [ ] Verify README quick-start and demo commands live; inspect changed files, tracked artifacts, and secret-like content.
- [ ] Commit any verification corrections, then push the branch without force.
- [ ] Update description and approved topics; create labels and 10–15 issues with context, expected behavior, likely files, and acceptance criteria.
- [ ] Create annotated tag and GitHub release `v0.1.0` only after the pushed commit and GitHub Actions succeed.
- [ ] Report exact branch, commit, URL, gates, remaining risks, and 30-day launch sequence.

