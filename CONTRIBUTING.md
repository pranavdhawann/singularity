# Contributing to Future

Thank you for helping build an inspectable local assistant. Small, testable changes are preferred.

## Setup

```powershell
git clone https://github.com/pranavdhawann/singularity.git
cd singularity
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install chromium
```

Use a focused branch. For behavior changes, add the smallest failing unit or browser test before implementation. Keep all tests offline and deterministic unless an issue explicitly defines a network boundary.

## Required checks

```powershell
corepack pnpm check
corepack pnpm --filter @future/web build
corepack pnpm test:e2e
git diff --check
```

`pnpm check` runs TypeScript, ESLint, Prettier verification, and unit/integration tests. Do not commit `.future`, environment files, SQLite databases, logs, Playwright reports, or dependency/build output.

## Pull requests

- Link a specific issue when one exists.
- Explain user-visible behavior, privacy/security effects, and verification output.
- Include screenshots for visible changes.
- Keep generated lockfile changes scoped to intentional dependency updates.
- Do not weaken source citations, redaction, session/origin enforcement, immutable grants, or safe error handling.
- Add a changelog entry for user-visible changes.

Architecture and ownership are mapped in [docs/contributor-roadmap.md](docs/contributor-roadmap.md). Report vulnerabilities through [SECURITY.md](SECURITY.md), never a public issue.
