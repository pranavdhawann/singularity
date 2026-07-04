# Build Runbook

This runbook covers the local Future MVP implementation.

## Prerequisites

- Node.js 24 or newer.
- Corepack enabled.
- Network access for the first dependency install.
- Playwright Chromium installed with `corepack pnpm exec playwright install chromium`.

## Install

```powershell
corepack pnpm install
```

The repository pins `pnpm@11.9.0` through `packageManager`. Build scripts for
`better-sqlite3` and `esbuild` are approved in `pnpm-workspace.yaml`.

## Run Locally

Start API and web together:

```powershell
corepack pnpm dev
```

Default local URLs:

- Web: `http://127.0.0.1:4173`
- API: `http://127.0.0.1:4174`
- API health: `http://127.0.0.1:4174/api/health`

The API stores local data at `.future/future.sqlite` unless `FUTURE_DB_PATH` is
set.

## Useful Environment Variables

- `FUTURE_DB_PATH`: SQLite database path.
- `PORT`: API port. Defaults to `4174`.

Example:

```powershell
$env:FUTURE_DB_PATH = ".future/dev.sqlite"
$env:PORT = "4174"
corepack pnpm --filter @future/api dev
```

## Mock Provider Flow

The mock provider requires no API key. It is used by the command runner and
Playwright hero flow to prove the local command loop without external network
model calls.

The implemented loop is:

1. Create a workspace through `POST /api/workspaces`.
2. Import Markdown, text, or ChatGPT export content through `POST /api/imports`.
3. Create and approve a memory through `POST /api/memories` and
   `POST /api/memories/:id/promote`.
4. Preview context through `POST /api/context-packs/preview`.
5. Run `ask_with_memory` through `POST /api/commands`.
6. Inspect the audit trail through `GET /api/timeline`.

## Verification Commands

```powershell
corepack pnpm check
corepack pnpm test:e2e
```

`pnpm check` runs typecheck, lint, and unit tests. `pnpm test:e2e` starts the API
and web app, then runs the Playwright hero flow in Chromium.

## Reset Local Data

Stop running dev servers, then remove local generated data:

```powershell
Remove-Item -Recurse -Force .future
```

Do not remove committed files or migration/schema files when resetting local
data.

