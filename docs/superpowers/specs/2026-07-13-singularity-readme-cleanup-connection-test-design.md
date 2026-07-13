# Singularity README, Repository Cleanup, and Provider Connection Test Design

## Goal

Present the project publicly as **Singularity**, remove repository artifacts that
are demonstrably obsolete, and solve GitHub issue #8 with a safe
OpenAI-compatible connection test during first-run setup.

The local checkout folder may remain `future` for now. Internal package scopes
such as `@future/core` and established environment variables such as
`FUTURE_OPENAI_API_KEY` also remain unchanged in this release so existing local
workflows do not break during a public-facing naming correction.

## Public Product and README

The README will become a first-visitor page for Singularity rather than an
explanation of why the product and repository have different names. It will:

- lead with Singularity as a local memory and explicit-permission layer for AI
  assistants;
- accurately describe the current `v0.1.0` implementation, including imports,
  cited retrieval, reviewed memory, Ollama and OpenAI-compatible providers,
  whole-prompt redaction, immutable approvals, and SQLite audit history;
- retain an honest early-release warning covering missing desktop packaging,
  encryption at rest, cloud sync, multi-user isolation, and autonomous actions;
- keep the deterministic `corepack pnpm demo` quick start and the real-model
  setup instructions;
- include a new recorded deterministic demo with a poster image and a direct
  video link, so the demo remains discoverable when inline playback is not
  available;
- explain that internal `@future/*` package names and `FUTURE_*` variables are
  compatibility identifiers pending a later internal rename.

User-facing app and deterministic-demo copy visible in the recording will use
Singularity. Internal identifiers, database paths, package names, API headers,
and environment variables will not be renamed in this change.

## Cleanup Boundary

Cleanup is evidence-based:

- delete generated `test-results/` from the main checkout after verification;
- remove completed historical implementation plans and superseded feature or
  cleanup design documents, while retaining the canonical continuous-assistant
  architecture design and the current design/plan until this work is complete;
- rename demo-facing assets and example copy when they would otherwise display
  the obsolete public product name;
- extend `.gitignore` for TypeScript build metadata, local tool caches, process
  files, patch rejects, and generated browser/video capture output;
- delete merged local and remote branches and their owned worktrees only after
  the new pull request is merged and the merge is verified.

The legacy `/api` routes are not dead code in this change. They remain registered,
tested compatibility surfaces and are explicitly documented as a migration
boundary. Removing them requires a separate compatibility decision. Current
release, security, contributor, architecture, and roadmap documentation also
remain unless a reference audit proves a file superseded.

## Safe Connection-Test Contract

The browser will call an authenticated mutation before persisting an external
provider. The request contains only configuration needed for the probe:

```ts
export interface TestProviderConnectionInput {
  kind: "openai-compatible";
  baseUrl: string;
  secretEnvironmentVariable: string;
}
```

The result is a discriminated union:

```ts
export type ProviderConnectionTestResult =
  | { status: "ok"; models: string[] }
  | { status: "missing_key"; message: string }
  | { status: "unreachable"; message: string }
  | { status: "unsupported"; message: string };
```

`POST /api/v2/providers/connection-test` resolves the named environment secret at
request time and performs `GET <normalized-base-url>/models` with an
`Authorization: Bearer ...` header. It never accepts or creates prompt content,
never creates provider or model-profile rows, and never returns or logs the
secret, authorization header, provider response body, or raw network error.

Classification is deterministic:

- missing environment name or missing environment value -> `missing_key`;
- invalid HTTP(S) base URL, fetch rejection, abort, or timeout -> `unreachable`;
- HTTP 401 or 403 -> `missing_key` with a safe missing-or-invalid credential
  message;
- any other non-success response, invalid JSON, or a success body without an
  OpenAI-compatible `data: Array<{ id: string }>` shape -> `unsupported`;
- a valid model list -> `ok`, returning only unique non-empty model IDs.

The server-side probe uses an injected fetch function and a bounded timeout so
unit tests are deterministic and setup cannot wait indefinitely.

## Setup Flow

For mock and Ollama providers, setup behavior remains unchanged. For an
OpenAI-compatible provider:

1. The user enters the base URL, secret environment-variable name, and model.
2. The UI offers **Test connection** and reports a concise status message.
3. Changing the base URL or secret environment-variable name clears the prior
   successful result.
4. Submitting setup runs the same connection test if the current values have not
   already passed.
5. Workspace, provider, and model-profile rows are created only after a successful
   test, preventing partial setup caused by connection failure.

The UI does not receive the secret value and does not display raw provider or
network details.

## Testing and Verification

Test-driven implementation will cover:

- core contract typing;
- service classification for success, missing secret, unreachable endpoint,
  authentication failure, unsupported status, and malformed success body;
- route authentication, safe response shape, and proof that no provider row is
  persisted by a probe;
- API-client use of the protected V2 mutation path;
- setup UI success, failure, revalidation after input changes, and no persistence
  before a successful probe;
- browser acceptance against the deterministic OpenAI-compatible test server,
  proving connection test and setup completion through the real app;
- README relative links and existence of the poster/video assets.

Final gates are:

```powershell
corepack pnpm check
corepack pnpm --filter @future/web build
corepack pnpm test:e2e
git diff --check
```

The deterministic demo will also be started on isolated ports, exercised through
a real browser, recorded, and stopped cleanly. After merge, local and remote
branch heads will be compared before worktrees and merged branches are removed.

## Delivery

All changes ship in one focused pull request linked to issue #8. The PR will be
marked ready, checks will be observed, and it will be merged into `main`. Issue #8
will be closed by the merged PR, and merged stale branches/worktrees—including
the prior launch-readiness branch—will then be pruned locally and remotely.
