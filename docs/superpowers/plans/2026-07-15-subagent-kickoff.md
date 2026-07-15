# Subagent-Driven Development — Kickoff Prompt

Use this to dispatch the Singularity v2 revamp. One subagent per task. Review
between tasks. Model per task is specified in each plan's assignment table.

## Plans (execute in order)

1. `docs/superpowers/plans/2026-07-15-plan1-safety-and-providers.md` — Units A, B, C
2. `docs/superpowers/plans/2026-07-15-plan2-auto-capture-memory.md` — Unit E
3. `docs/superpowers/plans/2026-07-15-plan3-chat-first-ui.md` — Units F, G, H

Spec: `docs/superpowers/specs/2026-07-15-singularity-chat-first-redaction-memory-design.md`

## Per-task dispatch prompt (copy, fill the blanks)

> You are implementing **one task** from an approved plan. Do not read ahead or
> touch other tasks.
>
> **Plan:** `<plan-file-path>`
> **Task:** `Task <N>: <title>`
> **Model:** `<Sonnet|Haiku from the plan's assignment table>`
>
> Rules:
>
> - Follow the task's steps exactly and in order (write failing test → run it →
>   implement → run it → commit). Use `superpowers:test-driven-development`.
> - Use the exact file paths, code, and commands in the task. If reality differs
>   from the plan (a type/field mismatch), fix minimally to make tests pass and
>   note the deviation in your final message.
> - Run every command with `CI=true` prefixed. Web tests need
>   `--environment jsdom`; add `afterEach(cleanup)` when a test file renders more
>   than once.
> - Do NOT mark the task done until its tests pass and you have committed with the
>   message from the task's final step.
> - Report back: what you changed, the passing test output, and any deviation.

## Ordering & parallelism

- **Backend wave 1 (parallel):** Plan 1 Tasks 1, 5, 6 (independent). Then 2→3→4
  (providers), 7 (needs 5,6), 8 (needs 4,7).
- **Backend wave 2:** Plan 2 Tasks 1→2→3→4 (3 needs Plan 1 Task 8's settings
  reader; coordinate `getSettings`).
- **Frontend (parallel with backend):** Plan 3 Tasks 1→2, 3, 5 independent; Task 4
  (badge) consumes Plan 1 Task 8's redaction summary — build against the shape,
  stub in tests until Plan 1 merges.

## Review gate between tasks (reviewer (you) checklist)

1. Tests for the task pass locally (paste output).
2. `CI=true corepack pnpm --filter <pkg> typecheck` clean for touched packages.
3. Commit exists with the specified message; diff matches the task's file list.
4. No secrets, raw prompts, or provider bodies added to any timeline/log payload.
5. No scope creep beyond the task.

## Definition of done (whole revamp)

- `CI=true corepack pnpm check` passes (typecheck, lint, format, tests).
- `CI=true corepack pnpm test:e2e` passes.
- Manual: first paint is one chat; gear opens Providers/Memory/Imports/Privacy;
  a cloud turn with an email auto-masks and streams; a cloud turn with a credit
  card pauses for approval; a stated fact is recalled in a later turn.
