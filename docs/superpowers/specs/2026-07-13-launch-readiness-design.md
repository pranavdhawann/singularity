# Future Launch Readiness Design

## Outcome

Future will ship as an early, functional `v0.1.0` local-first release whose public
promise is immediately clear: import ChatGPT history and project files, retrieve
cited context, and explicitly approve anything sent to an external model.

The product remains **Future**. The GitHub repository remains **singularity**;
public copy explains that relationship without treating Singularity as a second
product name or renaming the repository.

## Scope

This release adds launch foundations, not autonomous behavior. It includes:

- a first-visitor README, real local screenshot, accurate capability inventory,
  privacy guarantees, architecture map, roadmap, and contributor entry points;
- a deterministic offline demo command that starts Future, seeds a local
  workspace with the mock provider, and imports a bundled Markdown source;
- browser acceptance coverage for first setup, source import, cited retrieval,
  source inspection, external prompt approval, and denial;
- ESLint and Prettier gates plus GitHub Actions for frozen installation,
  typechecking, linting, formatting, tests, build, and Playwright;
- security, contribution, conduct, changelog, release, issue, and pull-request
  documentation;
- honest launch copy and a small contributor backlog with specific acceptance
  criteria.

Proactive jobs, cloud accounts, teams, broad integrations, autonomous external
actions, and repository renaming remain out of scope.

## Demo Architecture

`corepack pnpm demo` runs a small Node launcher. The launcher starts the existing
API and web processes with an isolated `.future/demo.sqlite` database, waits for
the protected local API, creates a workspace plus mock provider/profile only when
the database is empty, uploads `examples/future-demo.md` through the real multipart
route, and then keeps the app processes attached to the terminal. Re-running the
command is idempotent and never weakens session-token, origin, redaction, or prompt
approval enforcement.

The regular first-run interface remains available through `corepack pnpm dev`.
Ollama remains the simplest real-model route. OpenAI-compatible profiles continue
to resolve keys from environment variables at call time and require approval of
the exact redacted prompt.

## Verification and Release

Local and CI gates are the same: frozen install, `check`, web build, Playwright,
and `git diff --check`. The release checklist also verifies workflow syntax,
README commands, tracked-file hygiene, GitHub metadata, and the final tag. The
release is described as early and functional, never production-ready.
