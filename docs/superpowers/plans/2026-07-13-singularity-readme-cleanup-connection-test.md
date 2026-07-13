# Singularity README, Cleanup, and Connection Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present the product publicly as Singularity, remove proven repository debris, and add a safe OpenAI-compatible connection test to first-run setup.

**Architecture:** A focused `ProviderConnectionService` performs a bounded metadata-only `GET /models` probe and returns a shared discriminated union through a protected V2 route. The React setup flow calls that route before persistence. Public copy and deterministic demo assets are re-recorded as Singularity while internal `@future/*` and `FUTURE_*` compatibility identifiers remain unchanged.

**Tech Stack:** TypeScript 6, Fastify 5, React 19, Vitest 4, Playwright 1.61, pnpm 11, SQLite.

## Global Constraints

- Public product copy uses **Singularity**.
- Internal `@future/*` packages, `FUTURE_*` environment variables, `.future/` data paths, API headers, and database identifiers remain unchanged.
- The connection test sends no prompt or user context and persists no provider, profile, secret, response body, or raw network error.
- Only demonstrably generated, merged, superseded, or completed artifacts are deleted.
- Legacy `/api` compatibility routes remain in this change.
- The final branch must pass `corepack pnpm check`, the production web build, Playwright, and `git diff --check` before publication.

---

### Task 1: Shared Connection Contract and Probe Service

**Files:**

- Modify: `packages/core/src/providers.ts`
- Create: `apps/api/src/services/provider-connection-service.ts`
- Create: `apps/api/src/services/provider-connection-service.test.ts`

**Interfaces:**

- Consumes: `TestProviderConnectionInput` containing `kind`, `baseUrl`, and `secretEnvironmentVariable`.
- Produces: `ProviderConnectionService.test(input): Promise<ProviderConnectionTestResult>`.

- [ ] **Step 1: Add the shared input/result contract**

```ts
export interface TestProviderConnectionInput {
  kind: "openai-compatible";
  baseUrl: string;
  secretEnvironmentVariable: string;
}

export type ProviderConnectionTestResult =
  | { status: "ok"; models: string[] }
  | { status: "missing_key"; message: string }
  | { status: "unreachable"; message: string }
  | { status: "unsupported"; message: string };
```

- [ ] **Step 2: Write failing service tests for every classification**

```ts
const input: TestProviderConnectionInput = {
  kind: "openai-compatible",
  baseUrl: "https://models.example/v1/",
  secretEnvironmentVariable: "FUTURE_TEST_KEY",
};

it.each([
  [undefined, { status: "missing_key", message: "Set the configured environment variable and restart Singularity." }],
  ["", { status: "missing_key", message: "Set the configured environment variable and restart Singularity." }],
])("does not fetch when the key is missing", async (secret, expected) => {
  const request = vi.fn<typeof fetch>();
  const service = new ProviderConnectionService({ request, resolveSecret: () => secret });
  await expect(service.test(input)).resolves.toEqual(expected);
  expect(request).not.toHaveBeenCalled();
});

it("returns only unique model ids for a valid response", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data: [{ id: "model-a" }, { id: "model-a" }, { id: "model-b" }] }));
  const service = new ProviderConnectionService({ request, resolveSecret: () => "secret" });
  await expect(service.test(input)).resolves.toEqual({ status: "ok", models: ["model-a", "model-b"] });
  expect(request).toHaveBeenCalledWith(
    "https://models.example/v1/models",
    expect.objectContaining({ method: "GET", headers: { authorization: "Bearer secret" } }),
  );
});
```

Add distinct tests for invalid URL/fetch rejection -> `unreachable`, 401/403 -> `missing_key`, non-success -> `unsupported`, invalid JSON -> `unsupported`, and missing `data[].id` -> `unsupported`. Assertions must prove raw body/error markers never appear in the result.

- [ ] **Step 3: Run the service test and verify RED**

Run: `corepack pnpm --filter @future/api test -- provider-connection-service.test.ts`

Expected: FAIL because `ProviderConnectionService` does not exist.

- [ ] **Step 4: Implement the bounded metadata-only probe**

```ts
export interface ProviderConnectionServiceOptions {
  request?: typeof fetch;
  resolveSecret?: (name: string) => string | undefined;
  timeoutMs?: number;
}

export class ProviderConnectionService {
  private readonly request: typeof fetch;
  private readonly resolveSecret: (name: string) => string | undefined;
  private readonly timeoutMs: number;

  constructor(options: ProviderConnectionServiceOptions = {}) {
    this.request = options.request ?? fetch;
    this.resolveSecret = options.resolveSecret ?? ((name) => process.env[name]);
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async test(input: TestProviderConnectionInput): Promise<ProviderConnectionTestResult> {
    const apiKey = this.resolveSecret(input.secretEnvironmentVariable);
    if (!apiKey) return missingKey();
    const url = modelsUrl(input.baseUrl);
    if (!url) return { status: "unreachable", message: "Enter a valid HTTP or HTTPS provider base URL." };

    try {
      const response = await this.request(url, {
        method: "GET",
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (response.status === 401 || response.status === 403) return missingKey();
      if (!response.ok) return unsupported();
      const body: unknown = await response.json();
      const models = readModelIds(body);
      return models ? { status: "ok", models } : unsupported();
    } catch {
      return { status: "unreachable", message: "Singularity could not reach the provider endpoint." };
    }
  }
}
```

Keep `modelsUrl`, `readModelIds`, `missingKey`, and `unsupported` private to the module. `readModelIds` accepts only a non-empty array of objects with non-empty string `id` fields and de-duplicates IDs.

- [ ] **Step 5: Run the service test and verify GREEN**

Run: `corepack pnpm --filter @future/api test -- provider-connection-service.test.ts`

Expected: PASS with all classification tests green.

- [ ] **Step 6: Commit the contract and service**

```powershell
git add packages/core/src/providers.ts apps/api/src/services/provider-connection-service.ts apps/api/src/services/provider-connection-service.test.ts
git commit -m "feat: add safe provider connection probe"
```

### Task 2: Protected API Route and Browser Client

**Files:**

- Modify: `apps/api/src/server/dependencies.ts`
- Modify: `apps/api/src/server/create-server.ts`
- Modify: `apps/api/src/routes/v2/providers.ts`
- Modify: `apps/api/src/routes/v2/providers.test.ts`
- Modify: `apps/web/src/app/api-types.ts`
- Modify: `apps/web/src/app/api-client.ts`
- Modify: `apps/web/src/app/api-client.test.ts`

**Interfaces:**

- Consumes: `ProviderConnectionService` and shared input/result types from Task 1.
- Produces: authenticated `POST /api/v2/providers/connection-test` and `FutureApi.testProviderConnection(input)`.

- [ ] **Step 1: Write failing route tests**

```ts
it("requires the local session for connection tests", async () => {
  const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
  const response = await server.inject({
    method: "POST",
    url: "/api/v2/providers/connection-test",
    payload: {
      kind: "openai-compatible",
      baseUrl: "https://models.example/v1",
      secretEnvironmentVariable: "FUTURE_MISSING_KEY",
    },
  });
  expect(response.statusCode).toBe(401);
  await server.close();
});

it("returns a safe missing-key result without persisting a provider", async () => {
  const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
  const response = await server.inject({
    method: "POST",
    url: "/api/v2/providers/connection-test",
    headers: sessionHeaders,
    payload: {
      kind: "openai-compatible",
      baseUrl: "https://models.example/v1",
      secretEnvironmentVariable: "FUTURE_MISSING_KEY",
    },
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual(expect.objectContaining({ status: "missing_key" }));
  expect((await server.inject({ method: "GET", url: "/api/v2/providers" })).json()).toEqual({ providers: [] });
  await server.close();
});
```

- [ ] **Step 2: Write the failing API-client path test**

```ts
await client.testProviderConnection({
  kind: "openai-compatible",
  baseUrl: "https://models.example/v1",
  secretEnvironmentVariable: "FUTURE_OPENAI_API_KEY",
});
expect(fetch.mock.calls[1]?.[0]).toBe("/api/v2/providers/connection-test");
expect(fetch.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: "POST" }));
```

- [ ] **Step 3: Run route and client tests and verify RED**

Run: `corepack pnpm --filter @future/api test -- routes/v2/providers.test.ts`

Run: `corepack pnpm --filter @future/web test -- app/api-client.test.ts`

Expected: FAIL because the route and client method do not exist.

- [ ] **Step 4: Register the service and route**

Create one `ProviderConnectionService` in `createServer`, expose it as
`deps.providerConnectionService`, and register this schema before the provider
creation route:

```ts
server.post<{ Body: TestProviderConnectionInput }>(
  "/api/v2/providers/connection-test",
  {
    schema: {
      body: {
        type: "object",
        required: ["kind", "baseUrl", "secretEnvironmentVariable"],
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: ["openai-compatible"] },
          baseUrl: { type: "string", minLength: 1 },
          secretEnvironmentVariable: { type: "string", pattern: "^[A-Z][A-Z0-9_]*$" },
        },
      },
    },
  },
  async (request) => deps.providerConnectionService.test(request.body),
);
```

- [ ] **Step 5: Add the typed client method**

```ts
testProviderConnection(input: TestProviderConnectionInput): Promise<ProviderConnectionTestResult> {
  return this.mutate<ProviderConnectionTestResult>("/providers/connection-test", input);
}
```

Export/import both shared types through `api-types.ts`.

- [ ] **Step 6: Run route and client tests and verify GREEN**

Run both commands from Step 3. Expected: PASS.

- [ ] **Step 7: Commit the API boundary**

```powershell
git add apps/api/src/server apps/api/src/routes/v2/providers.ts apps/api/src/routes/v2/providers.test.ts apps/web/src/app
git commit -m "feat: expose provider connection test"
```

### Task 3: First-Run Connection-Test Experience

**Files:**

- Modify: `apps/web/src/features/setup/FirstRunSetup.tsx`
- Modify: `apps/web/src/features/setup/FirstRunSetup.test.tsx`
- Modify: `apps/web/src/styles/global.css`

**Interfaces:**

- Consumes: `FutureApi.testProviderConnection` from Task 2.
- Produces: visible Test connection control, safe result messaging, and pre-persistence validation.

- [ ] **Step 1: Write failing component tests**

Test these exact behaviors:

```ts
it("tests an external connection before persisting setup", async () => {
  const testProviderConnection = vi.fn(async () => ({ status: "ok" as const, models: ["model-a"] }));
  const createWorkspace = vi.fn(async () => ({ id: "w_1" }));
  const createProvider = vi.fn(async () => ({ id: "provider_external" }));
  const api = { testProviderConnection, createWorkspace, createProvider, createModelProfile: vi.fn() } as unknown as FutureApi;
  render(<FirstRunSetup api={api} workspaces={[]} providers={[]} modelProfiles={[]} onComplete={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai-compatible" } });
  fireEvent.change(screen.getByLabelText("Secret environment variable"), { target: { value: "FUTURE_TEST_KEY" } });
  fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
  await screen.findByText("Connected. 1 model available.");
  expect(createWorkspace).not.toHaveBeenCalled();
  expect(createProvider).not.toHaveBeenCalled();
});
```

Add a submit test where `missing_key` prevents every create call, and a test where changing Base URL after success clears the success message and causes submit to re-test.

- [ ] **Step 2: Run the setup test and verify RED**

Run: `corepack pnpm --filter @future/web test -- features/setup/FirstRunSetup.test.tsx`

Expected: FAIL because Test connection is absent.

- [ ] **Step 3: Implement connection state and guarded submit**

Use `testing`, `connectionResult`, and `testedFingerprint` state. The fingerprint is
`${baseUrl}\n${secretEnvironmentVariable}`. `testConnection()` calls the API and
returns `true` only for `ok`. Base URL or secret-name changes clear the result.

Render:

```tsx
<button
  type="button"
  className="secondary-action"
  disabled={testing || submitting}
  onClick={() => void testConnection()}
>
  {testing ? "Testing..." : "Test connection"}
</button>;
{
  connectionResult ? <p role="status">{connectionMessage(connectionResult)}</p> : null;
}
```

At the start of submit, before `createWorkspace`, require a successful current
fingerprint for `openai-compatible`; otherwise call `testConnection()` and return
without persistence on failure.

- [ ] **Step 4: Run the setup test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the setup UI**

```powershell
git add apps/web/src/features/setup apps/web/src/styles/global.css
git commit -m "feat: test external providers during setup"
```

### Task 4: Real-Browser Acceptance

**Files:**

- Modify: `tests/e2e/support/openai-compatible-server.ts`
- Modify: `tests/e2e/hero-flow.spec.ts`

**Interfaces:**

- Consumes: real setup UI and connection endpoint from Tasks 2-3.
- Produces: Playwright proof that the real app probes `/v1/models`, reports success, persists nothing before submission, and can switch back to the offline setup path.

- [ ] **Step 1: Add model metadata to the deterministic provider server**

```ts
if (request.method === "GET" && request.url === "/v1/models") {
  if (request.headers.authorization !== "Bearer phase4-test-secret") {
    response.writeHead(401).end();
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ data: [{ id: "phase4-model" }] }));
  return;
}
```

- [ ] **Step 2: Extend the initial hero setup test**

Before the mock setup is submitted, select OpenAI-compatible, fill
`http://127.0.0.1:4280/v1` and `FUTURE_TEST_OPENAI_KEY`, click Test connection,
assert `Connected. 1 model available.`, query `/api/v2/providers` and assert the
list remains empty, then switch back to Mock and complete the existing offline
hero flow.

- [ ] **Step 3: Run Playwright and verify the browser path**

Run: `corepack pnpm test:e2e`

Expected: all existing tests plus the connection-test assertions pass.

- [ ] **Step 4: Commit browser acceptance**

```powershell
git add tests/e2e/support/openai-compatible-server.ts tests/e2e/hero-flow.spec.ts
git commit -m "test: cover provider connection setup"
```

### Task 5: Singularity Public Surface, Demo Media, and Repository Cleanup

**Files:**

- Modify: `README.md`
- Modify: `.gitignore`
- Modify: `.prettierignore`
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/src/features/setup/FirstRunSetup.tsx`
- Modify: `apps/web/src/features/assistant/AssistantComposer.tsx`
- Modify: `apps/web/src/features/assistant/AssistantComposer.test.tsx`
- Modify: `apps/web/src/features/timeline/TimelineView.tsx`
- Modify: `apps/web/src/features/memory/MemoryBrowser.tsx`
- Modify: `scripts/demo.mjs`
- Modify: `scripts/demo.test.ts`
- Rename: `examples/future-demo.md` to `examples/singularity-demo.md`
- Create: `docs/assets/singularity-demo.png`
- Create: `docs/assets/singularity-demo.webm`
- Delete: `docs/assets/future-demo.png`
- Delete: `docs/superpowers/plans/2026-07-11-future-v2-phase-4-imports-external-models.md`
- Delete: `docs/superpowers/plans/2026-07-11-repository-cleanup-and-documentation.md`
- Delete: `docs/superpowers/plans/2026-07-13-launch-readiness-v0.1.0.md`
- Delete: `docs/superpowers/specs/2026-07-11-future-v2-phase-4-imports-external-models-design.md`
- Delete: `docs/superpowers/specs/2026-07-11-repository-cleanup-and-documentation-design.md`
- Delete: `docs/superpowers/specs/2026-07-13-launch-readiness-design.md`

**Interfaces:**

- Consumes: the verified deterministic demo flow.
- Produces: coherent Singularity-facing app/demo/README plus a smaller repository history surface.

- [ ] **Step 1: Update public UI tests to expect Singularity**

Apply these exact assertion mappings:

```text
Set up Future -> Set up Singularity
Message Future -> Message Singularity
Hello Future -> Hello Singularity
Future Demo -> Singularity Demo
```

Keep `FutureApi`, `@future/*`, `x-future-session`, and `FUTURE_*` identifiers
unchanged because they are compatibility identifiers rather than public copy.

- [ ] **Step 2: Run focused UI/demo tests and verify RED**

Run: `corepack pnpm --filter @future/web test -- app/App.test.tsx features/assistant/AssistantComposer.test.tsx`

Run: `corepack pnpm test:demo`

Expected: FAIL on obsolete public copy and demo source names.

- [ ] **Step 3: Align public app and deterministic demo copy**

Apply these exact production/demo mappings:

```text
Future -> Singularity in rendered headings, labels, placeholders, and status text
Future Demo -> Singularity Demo
examples/future-demo.md -> examples/singularity-demo.md
future-demo.md -> singularity-demo.md
Future API did not become ready -> Singularity API did not become ready
Future demo seeded -> Singularity demo seeded
Future demo already exists -> Singularity demo already exists
```

Update `tests/e2e/hero-flow.spec.ts`, `scripts/demo.test.ts`, `README.md`, and
`docs/10-build-runbook.md` references to the renamed example. Do not replace
TypeScript symbols or compatibility identifiers.

- [ ] **Step 4: Strengthen ignore rules**

Append these generated-only rules in the appropriate sections:

```gitignore
.eslintcache
.npm/
.yarn/
*.tsbuildinfo
*.pid
*.pid.lock
*.orig
*.rej
output/
.playwright/
```

Add `output` and `.playwright` to `.prettierignore`.

- [ ] **Step 5: Remove superseded history artifacts**

Delete exactly these files:

```text
docs/superpowers/plans/2026-07-11-future-v2-phase-4-imports-external-models.md
docs/superpowers/plans/2026-07-11-repository-cleanup-and-documentation.md
docs/superpowers/plans/2026-07-13-launch-readiness-v0.1.0.md
docs/superpowers/specs/2026-07-11-future-v2-phase-4-imports-external-models-design.md
docs/superpowers/specs/2026-07-11-repository-cleanup-and-documentation-design.md
docs/superpowers/specs/2026-07-13-launch-readiness-design.md
```

Retain `2026-07-10-future-v2-continuous-assistant-design.md`, the current
approved design, and this current implementation plan.

- [ ] **Step 6: Rewrite README.md**

Use this top-level structure: badges; Singularity positioning; clickable demo
poster/video; Why Singularity; 60-second demo; provider setup including Test
connection; current capabilities; privacy/security boundary; architecture;
roadmap; compatibility identifiers; contributing; license. All claims must match
the current implementation and `SECURITY.md`.

The media block is:

```md
[![Watch Singularity retrieve a cited local source](docs/assets/singularity-demo.png)](docs/assets/singularity-demo.webm)

[Watch the Singularity demo video](docs/assets/singularity-demo.webm) — run the offline demo, ask a question, and inspect the cited local source.
```

- [ ] **Step 7: Record the deterministic browser demo**

Verify `npx` exists:

```powershell
Get-Command npx
```

Start the demo hidden and wait for the web endpoint:

```powershell
New-Item -ItemType Directory -Force output/playwright | Out-Null
$demo = Start-Process -FilePath "corepack.cmd" -ArgumentList "pnpm", "demo" -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru -RedirectStandardOutput "output/playwright/demo.stdout.log" -RedirectStandardError "output/playwright/demo.stderr.log"
$deadline = (Get-Date).AddSeconds(60)
do {
  try { $ready = (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4173).StatusCode -eq 200 } catch { $ready = $false }
  if (-not $ready) { Start-Sleep -Milliseconds 250 }
} until ($ready -or (Get-Date) -gt $deadline)
if (-not $ready) { throw "Singularity demo did not start" }
```

Record and capture the final citation inspector using the installed browser:

```powershell
@'
import { chromium } from "@playwright/test";
import { copyFile, mkdir } from "node:fs/promises";
await mkdir("output/playwright/video", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: "output/playwright/video", size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const video = page.video();
await page.goto("http://127.0.0.1:4173");
await page.getByLabel("Message Singularity").fill("launch readiness decision");
await page.getByRole("button", { name: "Send" }).click();
const citation = page.getByRole("button", { name: /Citation 1:/ }).last();
await citation.waitFor();
await citation.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "docs/assets/singularity-demo.png", fullPage: true });
await context.close();
await copyFile(await video.path(), "docs/assets/singularity-demo.webm");
await browser.close();
'@ | node --input-type=module -
Stop-Process -Id $demo.Id -Force -ErrorAction SilentlyContinue
```

Confirm the poster and video exist and are non-empty, then confirm ports 4173
and 4174 no longer answer. Keep no temporary recorder source file.

- [ ] **Step 8: Verify links and focused tests**

Run the Step 2 tests, then check every relative README target:

```powershell
$content = Get-Content README.md -Raw
$links = [regex]::Matches($content, '!?' + '\\[[^\\]]*\\]\\((?!https?://|mailto:)([^)#]+)(?:#[^)]*)?\\)')
foreach ($link in $links) {
  $target = [Uri]::UnescapeDataString($link.Groups[1].Value.Trim('<', '>'))
  if (-not (Test-Path -LiteralPath $target)) { throw "Missing README target: $target" }
}
```

Expected: focused tests pass and the link script exits without an exception.

- [ ] **Step 9: Commit the public surface and cleanup**

```powershell
git add -A
git commit -m "docs: present the project as Singularity"
```

### Task 6: Full Verification, Publication, Merge, and Branch Cleanup

**Files:**

- Verify all changed files.
- Remove ignored generated `test-results/` from the main checkout after merge.

**Interfaces:**

- Consumes: Tasks 1-5.
- Produces: merged `main`, closed issue #8, matching local/remote heads, and no merged stale branches/worktrees.

- [ ] **Step 1: Run all fresh verification gates**

```powershell
corepack pnpm check
corepack pnpm --filter @future/web build
corepack pnpm test:e2e
git diff --check
```

Expected: every command exits 0 with no test failures or formatting errors.

- [ ] **Step 2: Inspect scope and history**

```powershell
git status --short --branch
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
git log --oneline origin/main..HEAD
```

Confirm every changed/deleted file belongs to the approved design.

- [ ] **Step 3: Push and open a ready pull request**

Push `codex/singularity-readme-issue-8`, open a ready PR against `main`, include
`Closes #8`, summarize the security boundary and cleanup, and list all four
verification gates.

- [ ] **Step 4: Observe required checks and merge**

Wait for GitHub checks to complete successfully, then squash-merge the PR and
delete its remote branch.

- [ ] **Step 5: Verify merged state**

Update the main checkout, rerun the four verification gates from merged `main`,
and confirm `git rev-parse HEAD` matches
`git ls-remote origin refs/heads/main`.

- [ ] **Step 6: Remove merged worktrees and branches**

From the main checkout, remove the owned worktrees for this branch and
`codex/launch-readiness-v0.1.0`, prune worktree registrations, delete their local
branches, and delete any remaining merged remote branch. Do not force-delete an
unmerged branch.

- [ ] **Step 7: Remove ignored generated output and report**

Delete only ignored generated `test-results/`, `playwright-report/`, and
`output/playwright/` directories. Report the PR URL, merge commit, issue state,
test evidence, local/remote head match, and final branch/worktree inventory.
