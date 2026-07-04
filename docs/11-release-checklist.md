# Release Checklist

Use this checklist before treating the local MVP as releasable.

## Required Commands

- [ ] `corepack pnpm install` completes.
- [ ] `corepack pnpm check` passes.
- [ ] `corepack pnpm test:e2e` passes.

## Functional Gates

- [ ] Clean SQLite startup creates the schema from scratch.
- [ ] Web app starts and shows the command center as the first screen.
- [ ] `GET /api/health` returns `{ "ok": true }`.
- [ ] `POST /api/workspaces` creates a workspace and `workspace.created`
  timeline event.
- [ ] `POST /api/imports` imports Markdown fixture content and records
  `import.started`, `document.imported`, and `import.finished`.
- [ ] Imported content is searchable through SQLite FTS5.
- [ ] `POST /api/memories` creates a proposed memory.
- [ ] `POST /api/memories/:id/promote` approves a memory and writes
  `memory.approved`.
- [ ] `PATCH /api/memories/:id` can edit or pin a memory.
- [ ] `DELETE /api/memories/:id` removes a memory and writes `memory.deleted`.
- [ ] `POST /api/context-packs/preview` returns approved memory context.
- [ ] External-model permission requests can be created and decided.
- [ ] Redaction replaces API-key shaped secrets before external model use.
- [ ] `POST /api/commands` with the mock provider records `command.started`,
  `context_pack.created`, `model_call.completed`, and
  `assistant.response.created`.
- [ ] `GET /api/timeline` shows the full audit trail for a workspace.

## Manual Inspection

- [ ] `README.md` links to the design, blueprint, runbook, and checklist.
- [ ] The command center layout has left navigation, top workspace bar, command
  palette, timeline, inspector, and activity strip.
- [ ] Prompt preview UI shows provider, model, context items, and redaction
  count.
- [ ] Permissions UI shows current capability states.
- [ ] No generated folders such as `.future/`, `node_modules/`, `test-results/`,
  or `playwright-report/` are tracked.

