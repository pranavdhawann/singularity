# Future MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local Future MVP that imports workspace context, turns it into inspectable memory, builds source-backed context packs, routes prompts through approved model providers, and records every meaningful action in a timeline.

**Architecture:** Use a TypeScript monorepo with a Vite React web client, a local TypeScript Node API, SQLite as the local source of truth, package-level domain boundaries, and a provider abstraction that supports mock, OpenAI-compatible, and Ollama-compatible model calls. The API owns filesystem, database, provider, permission, and import operations; the browser talks only to the local API.

**Tech Stack:** TypeScript, React, Vite, Fastify, SQLite, Drizzle, SQLite FTS5, Vitest, Playwright, pnpm workspaces, local HTTP API, mock provider first, OpenAI-compatible provider second, Ollama-compatible provider third.

---

Source design: `docs/superpowers/specs/2026-07-04-future-end-to-end-design.md`

## File Structure Map

- Create `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, and root
  quality scripts.
- Create `apps/web` for the command-center UI.
- Create `apps/api` for the local HTTP API and job orchestration.
- Create `packages/core` for shared types and pure domain contracts.
- Create `packages/db` for schema, migrations, repositories, and temporary test
  database helpers.
- Create `packages/importers` for ChatGPT JSON, Markdown, plain text, and
  workspace-folder importers.
- Create `packages/memory` for memory proposal, review, compaction, and state
  transitions.
- Create `packages/retrieval` for FTS search, context-pack construction, and the
  vector adapter boundary.
- Create `packages/providers` for mock, OpenAI-compatible, and Ollama-compatible
  adapters.
- Create `packages/permissions` for permission decisions, request records, and
  redaction.
- Create `tests/e2e` for Playwright hero-flow smoke tests.

## Task 1: Monorepo Scaffold and Quality Gates

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `apps/web/package.json`
- Create: `apps/api/package.json`
- Create: `packages/core/package.json`
- Create: `packages/db/package.json`
- Create: `packages/importers/package.json`
- Create: `packages/memory/package.json`
- Create: `packages/retrieval/package.json`
- Create: `packages/providers/package.json`
- Create: `packages/permissions/package.json`

- [ ] **Step 1: Create root workspace manifest**

```json
{
  "name": "future",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.9.0",
  "scripts": {
    "dev": "pnpm --parallel --filter @future/api --filter @future/web dev",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "test:e2e": "playwright test",
    "check": "pnpm typecheck && pnpm lint && pnpm test"
  },
  "devDependencies": {
    "@playwright/test": "1.61.1",
    "typescript": "6.0.3",
    "vitest": "4.1.9"
  }
}
```

- [ ] **Step 2: Create pnpm workspace file**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create shared TypeScript config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 4: Add package manifests for each workspace package**

Use package names `@future/web`, `@future/api`, `@future/core`, `@future/db`,
`@future/importers`, `@future/memory`, `@future/retrieval`,
`@future/providers`, and `@future/permissions`. Each package needs scripts:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

- [ ] **Step 5: Verify scaffold**

Run: `pnpm install`

Expected: dependency installation completes and creates `pnpm-lock.yaml`.

Run: `pnpm typecheck`

Expected: all packages typecheck after empty `src/index.ts` entry files are
created for packages that do not yet have implementation code.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json apps packages pnpm-lock.yaml
git commit -m "chore: scaffold future monorepo"
```

## Task 2: Core Domain Contracts

**Files:**

- Create: `packages/core/src/ids.ts`
- Create: `packages/core/src/events.ts`
- Create: `packages/core/src/memory.ts`
- Create: `packages/core/src/providers.ts`
- Create: `packages/core/src/permissions.ts`
- Create: `packages/core/src/context-packs.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/src/events.test.ts`
- Test: `packages/core/src/permissions.test.ts`

- [ ] **Step 1: Write event validation tests**

```ts
import { describe, expect, it } from "vitest";
import { createEvent } from "./events";

describe("createEvent", () => {
  it("creates a timeline event with a stable workspace and type", () => {
    const event = createEvent({
      workspaceId: "w_demo",
      type: "workspace.created",
      actor: "user",
      title: "Created Demo",
      payload: { name: "Demo" },
      privacy: { labels: ["local"] }
    });

    expect(event.id).toMatch(/^evt_/);
    expect(event.workspaceId).toBe("w_demo");
    expect(event.type).toBe("workspace.created");
    expect(event.createdAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Write permission decision tests**

```ts
import { describe, expect, it } from "vitest";
import { decidePermission } from "./permissions";

describe("decidePermission", () => {
  it("requires approval for external model use by default", () => {
    const result = decidePermission({
      capability: "use_external_models",
      rules: [],
      requestedScope: { workspaceId: "w_demo" }
    });

    expect(result.decision).toBe("needs_approval");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @future/core test`

Expected: tests fail because `createEvent` and `decidePermission` are not
implemented.

- [ ] **Step 4: Implement shared domain types**

```ts
// packages/core/src/events.ts
import { createId } from "./ids";

export type EventActor = "user" | "assistant" | "system" | "job";

export interface TimelineEventInput {
  workspaceId: string;
  type: string;
  actor: EventActor;
  title: string;
  payload: Record<string, unknown>;
  privacy: Record<string, unknown>;
}

export interface TimelineEvent extends TimelineEventInput {
  id: string;
  createdAt: Date;
}

export function createEvent(input: TimelineEventInput): TimelineEvent {
  return {
    id: createId("evt"),
    createdAt: new Date(),
    ...input
  };
}
```

```ts
// packages/core/src/ids.ts
export function createId(prefix: string): string {
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  return `${prefix}_${random}`;
}
```

```ts
// packages/core/src/permissions.ts
export type PermissionCapability =
  | "read_files"
  | "write_files"
  | "run_commands"
  | "browse_web"
  | "call_apis"
  | "write_memory"
  | "use_external_models";

export type PermissionState =
  | "deny"
  | "ask_every_time"
  | "allow_for_session"
  | "allow_for_workspace"
  | "always_allow";

export interface PermissionRule {
  capability: PermissionCapability;
  state: PermissionState;
  workspaceId?: string;
  expiresAt?: Date;
}

export interface PermissionDecisionInput {
  capability: PermissionCapability;
  rules: PermissionRule[];
  requestedScope: { workspaceId: string };
}

export function decidePermission(input: PermissionDecisionInput): {
  decision: "allow" | "deny" | "needs_approval";
  matchedRule?: PermissionRule;
} {
  const matchingRule = input.rules.find((rule) => {
    if (rule.capability !== input.capability) return false;
    if (rule.workspaceId && rule.workspaceId !== input.requestedScope.workspaceId) return false;
    if (rule.expiresAt && rule.expiresAt.getTime() < Date.now()) return false;
    return true;
  });

  if (!matchingRule) {
    return input.capability === "use_external_models"
      ? { decision: "needs_approval" }
      : { decision: "deny" };
  }

  if (matchingRule.state === "deny") return { decision: "deny", matchedRule: matchingRule };
  if (matchingRule.state === "ask_every_time") return { decision: "needs_approval", matchedRule: matchingRule };
  return { decision: "allow", matchedRule: matchingRule };
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `pnpm --filter @future/core test`

Expected: both tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat: add core domain contracts"
```

## Task 3: SQLite Schema, Migrations, and Event Store

**Files:**

- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/connection.ts`
- Create: `packages/db/src/repositories/events.ts`
- Create: `packages/db/src/test-db.ts`
- Test: `packages/db/src/repositories/events.test.ts`

- [ ] **Step 1: Write event repository test**

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../test-db";
import { EventRepository } from "./events";

describe("EventRepository", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("stores and lists timeline events in created order", () => {
    const repo = new EventRepository(db.client);

    repo.append({
      id: "evt_one",
      workspaceId: "w_demo",
      type: "workspace.created",
      actor: "user",
      title: "Created Demo",
      payload: { name: "Demo" },
      privacy: { labels: ["local"] },
      createdAt: new Date("2026-07-04T12:00:00.000Z")
    });

    const events = repo.list({ workspaceId: "w_demo" });
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("evt_one");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @future/db test`

Expected: fails because the database repository does not exist.

- [ ] **Step 3: Implement schema and repository**

Create tables from the design spec: `workspaces`, `events`, `event_sources`,
`imports`, `documents`, `document_chunks`, `document_chunks_fts`, `memories`,
`memory_sources`, `providers`, `model_profiles`, `permission_rules`,
`permission_requests`, `context_packs`, `retrieval_runs`, and `jobs`.

The `EventRepository.append()` method must insert event rows inside a
transaction and serialize `payload` and `privacy` as JSON. The `list()` method
must filter by workspace and return newest first by default.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @future/db test`

Expected: event repository test passes.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat: add sqlite event store"
```

## Task 4: Local API Skeleton

**Files:**

- Create: `apps/api/src/server/create-server.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/workspaces.ts`
- Create: `apps/api/src/routes/timeline.ts`
- Create: `apps/api/src/index.ts`
- Test: `apps/api/src/server/create-server.test.ts`

- [ ] **Step 1: Write health and timeline route test**

```ts
import { describe, expect, it } from "vitest";
import { createServer } from "./create-server";

describe("createServer", () => {
  it("serves health", async () => {
    const server = await createServer({ databasePath: ":memory:" });
    const response = await server.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @future/api test`

Expected: fails because `createServer` is missing.

- [ ] **Step 3: Implement Fastify server**

Register `/api/health`, `/api/workspaces`, and `/api/timeline`. Each route uses
schema validation. Workspace creation appends a `workspace.created` timeline
event in the same request.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @future/api test`

Expected: API tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: add local api skeleton"
```

## Task 5: Web Command Center Shell

**Files:**

- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/api-client.ts`
- Create: `apps/web/src/features/timeline/TimelineView.tsx`
- Create: `apps/web/src/features/workspaces/WorkspaceSwitcher.tsx`
- Create: `apps/web/src/features/command-palette/CommandPalette.tsx`
- Create: `apps/web/src/styles/global.css`
- Test: `apps/web/src/app/App.test.tsx`

- [ ] **Step 1: Write shell render test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the command center shell", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /command palette/i })).toBeInTheDocument();
    expect(screen.getByText(/timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/memory/i)).toBeInTheDocument();
    expect(screen.getByText(/permissions/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @future/web test`

Expected: fails because `App` is missing.

- [ ] **Step 3: Implement shell**

Build the first screen with left rail, top bar, main timeline panel, right
inspector, command palette button, provider indicator, privacy indicator, and
bottom activity strip. Use restrained operational UI: dense spacing, clear
states, no decorative hero section.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @future/web test`

Expected: shell render test passes.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: add command center shell"
```

## Task 6: Import Pipeline and Search

**Files:**

- Create: `packages/importers/src/text.ts`
- Create: `packages/importers/src/markdown.ts`
- Create: `packages/importers/src/chatgpt.ts`
- Create: `packages/importers/src/chunk.ts`
- Create: `packages/retrieval/src/lexical.ts`
- Create: `apps/api/src/routes/imports.ts`
- Test: `packages/importers/src/chatgpt.test.ts`
- Test: `packages/retrieval/src/lexical.test.ts`

- [ ] **Step 1: Write ChatGPT import parser test**

```ts
import { describe, expect, it } from "vitest";
import { parseChatGptExport } from "./chatgpt";

describe("parseChatGptExport", () => {
  it("normalizes conversations into source documents", () => {
    const result = parseChatGptExport({
      conversations: [
        {
          title: "Future planning",
          mapping: {
            a: { message: { author: { role: "user" }, content: { parts: ["Build Future"] } } }
          }
        }
      ]
    });

    expect(result.documents[0]?.title).toBe("Future planning");
    expect(result.documents[0]?.text).toContain("Build Future");
  });
});
```

- [ ] **Step 2: Run parser test to verify it fails**

Run: `pnpm --filter @future/importers test`

Expected: fails because `parseChatGptExport` is missing.

- [ ] **Step 3: Implement importers**

Implement text, Markdown, and ChatGPT parsers that return normalized
`ImportedDocument` records with title, source URI, media type, text, hash, and
metadata. Add chunking with stable chunk indexes and source ranges.

- [ ] **Step 4: Implement FTS indexing and lexical search**

Use SQLite FTS5 over `document_chunks`. Search returns chunk ID, document ID,
title, snippet, rank, and source range.

- [ ] **Step 5: Add API route**

`POST /api/imports` starts an import job, writes `import.started`,
`document.imported`, and `import.finished` events, and returns the job ID.

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @future/importers test`

Expected: parser tests pass.

Run: `pnpm --filter @future/retrieval test`

Expected: lexical search tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/importers packages/retrieval apps/api
git commit -m "feat: add import pipeline and lexical search"
```

## Task 7: Memory Proposal and Review

**Files:**

- Create: `packages/memory/src/extractor.ts`
- Create: `packages/memory/src/reviewer.ts`
- Create: `packages/memory/src/state.ts`
- Create: `apps/api/src/routes/memories.ts`
- Create: `apps/web/src/features/memory/MemoryBrowser.tsx`
- Test: `packages/memory/src/state.test.ts`
- Test: `apps/api/src/routes/memories.test.ts`

- [ ] **Step 1: Write memory state transition test**

```ts
import { describe, expect, it } from "vitest";
import { transitionMemory } from "./state";

describe("transitionMemory", () => {
  it("promotes proposed memory to approved memory", () => {
    const next = transitionMemory({
      reviewState: "proposed",
      action: "approve",
      actor: "user"
    });

    expect(next.reviewState).toBe("approved");
    expect(next.revisionReason).toBe("user approved memory");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @future/memory test`

Expected: fails because `transitionMemory` is missing.

- [ ] **Step 3: Implement memory state machine**

Allowed transitions are:

- `proposed -> approved`
- `proposed -> rejected`
- `approved -> outdated`
- `approved -> rejected`
- `approved -> approved` for edit revisions
- `outdated -> approved` for reconfirmation

Each transition creates a memory revision and timeline event.

- [ ] **Step 4: Implement memory browser**

Render tabs for facts, episodes, procedures, decisions, tasks, summaries,
uncertain, pinned, and recently used. Each card shows confidence, review state,
source count, privacy label, and actions for edit, delete, pin, relabel, mark
outdated, and show sources.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @future/memory test`

Expected: state transition tests pass.

Run: `pnpm --filter @future/api test`

Expected: memories route tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/memory apps/api apps/web
git commit -m "feat: add inspectable memory review"
```

## Task 8: Providers, Context Packs, and Prompt Preview

**Files:**

- Create: `packages/providers/src/types.ts`
- Create: `packages/providers/src/mock.ts`
- Create: `packages/providers/src/openai-compatible.ts`
- Create: `packages/providers/src/ollama.ts`
- Create: `packages/providers/src/registry.ts`
- Create: `packages/retrieval/src/context-pack.ts`
- Create: `apps/api/src/routes/providers.ts`
- Create: `apps/api/src/routes/context-packs.ts`
- Create: `apps/web/src/features/prompt-preview/PromptPreview.tsx`
- Test: `packages/providers/src/mock.test.ts`
- Test: `packages/retrieval/src/context-pack.test.ts`

- [ ] **Step 1: Write mock provider streaming test**

```ts
import { describe, expect, it } from "vitest";
import { MockProvider } from "./mock";

describe("MockProvider", () => {
  it("streams deterministic chunks", async () => {
    const provider = new MockProvider();
    const chunks: string[] = [];

    for await (const chunk of provider.streamText({ prompt: "hello", model: "mock" })) {
      chunks.push(chunk.text);
    }

    expect(chunks.join("")).toContain("Mock response");
  });
});
```

- [ ] **Step 2: Write context-pack budget test**

```ts
import { describe, expect, it } from "vitest";
import { buildContextPack } from "./context-pack";

describe("buildContextPack", () => {
  it("keeps selected items inside the requested token budget", () => {
    const pack = buildContextPack({
      command: "What did we decide?",
      budgetTokens: 80,
      memories: [
        { id: "mem_1", text: "Use SQLite as the source of truth.", tokenCount: 9, score: 10 }
      ],
      chunks: [],
      recentEvents: []
    });

    expect(pack.items.map((item) => item.id)).toEqual(["mem_1"]);
    expect(pack.estimatedTokens).toBeLessThanOrEqual(80);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @future/providers test`

Expected: fails because `MockProvider` is missing.

Run: `pnpm --filter @future/retrieval test`

Expected: fails because `buildContextPack` is missing.

- [ ] **Step 4: Implement providers**

Implement the provider interface with `listModels`, `streamText`, and optional
`createEmbedding`. The mock provider returns deterministic chunks. The
OpenAI-compatible provider calls the configured chat-completions-compatible
endpoint. A later provider-specific OpenAI adapter can add APIs that are not
part of the compatibility contract. The Ollama provider calls the local
endpoint and is marked local.

- [ ] **Step 5: Implement context-pack preview**

Context-pack preview returns command intent, selected memories, source chunks,
recent events, permission state, redactions, estimated token count, and citation
IDs. External providers require preview before `POST /api/model-calls`.

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @future/providers test`

Expected: provider tests pass.

Run: `pnpm --filter @future/retrieval test`

Expected: context-pack tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/providers packages/retrieval apps/api apps/web
git commit -m "feat: add providers and prompt preview"
```

## Task 9: Permission Engine and Redaction

**Files:**

- Create: `packages/permissions/src/engine.ts`
- Create: `packages/permissions/src/redaction.ts`
- Create: `apps/api/src/routes/permissions.ts`
- Create: `apps/web/src/features/permissions/PermissionsPanel.tsx`
- Test: `packages/permissions/src/redaction.test.ts`
- Test: `apps/api/src/routes/permissions.test.ts`

- [ ] **Step 1: Write redaction tests**

```ts
import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "./redaction";

describe("redactSensitiveText", () => {
  it("redacts API-key shaped secrets", () => {
    const result = redactSensitiveText("token sk-1234567890abcdef");
    expect(result.text).toBe("token [REDACTED_SECRET]");
    expect(result.redactions[0]?.kind).toBe("secret");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @future/permissions test`

Expected: fails because `redactSensitiveText` is missing.

- [ ] **Step 3: Implement permission engine**

The engine evaluates capability, workspace, destination, provider locality,
grant state, expiration, and prompt preview requirement. It returns `allow`,
`deny`, or `needs_approval` and writes a permission request when approval is
needed.

- [ ] **Step 4: Implement redaction**

Redact API-key shaped strings, bearer tokens, private key blocks, email
addresses, phone numbers, and obvious local credential paths before external
model calls. Record redaction kind, range, and replacement in the context pack.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @future/permissions test`

Expected: redaction and engine tests pass.

Run: `pnpm --filter @future/api test`

Expected: permissions route tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/permissions apps/api apps/web
git commit -m "feat: add permission and redaction gates"
```

## Task 10: Command Execution Loop and Hero Flow

**Files:**

- Create: `apps/api/src/routes/commands.ts`
- Create: `apps/api/src/services/command-runner.ts`
- Create: `apps/web/src/features/command-palette/commands.ts`
- Create: `apps/web/src/features/assistant/AssistantResponse.tsx`
- Create: `tests/e2e/hero-flow.spec.ts`
- Test: `apps/api/src/services/command-runner.test.ts`

- [ ] **Step 1: Write command runner test**

```ts
import { describe, expect, it } from "vitest";
import { runCommand } from "./command-runner";

describe("runCommand", () => {
  it("creates timeline records for ask-with-memory command", async () => {
    const result = await runCommand({
      workspaceId: "w_demo",
      command: "ask_with_memory",
      input: "What should we build first?",
      providerId: "mock"
    });

    expect(result.events.map((event) => event.type)).toEqual([
      "command.started",
      "context_pack.created",
      "model_call.completed",
      "assistant.response.created"
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @future/api test`

Expected: fails because command runner is missing.

- [ ] **Step 3: Implement command runner**

For `ask_with_memory`, the runner creates a command event, builds a context pack,
checks permissions, calls the selected provider, streams response chunks, stores
model call metadata, stores assistant response event, and returns cited sources.

- [ ] **Step 4: Add Playwright hero-flow test**

The test launches the app, creates a workspace, imports a fixture Markdown file,
approves a proposed memory, opens prompt preview, uses the mock provider, and
asserts that timeline contains import, memory, context pack, model call, and
assistant response events.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @future/api test`

Expected: command runner tests pass.

Run: `pnpm test:e2e`

Expected: hero-flow test passes in Chromium.

- [ ] **Step 6: Commit**

```bash
git add apps/api apps/web tests/e2e
git commit -m "feat: complete first future hero flow"
```

## Task 11: Final Documentation, Verification, and Release Check

**Files:**

- Modify: `README.md`
- Create: `docs/10-build-runbook.md`
- Create: `docs/11-release-checklist.md`

- [ ] **Step 1: Write runbook**

Document local setup, storage location, provider setup, import fixture flow,
mock provider flow, and reset instructions.

- [ ] **Step 2: Write release checklist**

Checklist must include install, typecheck, lint, unit tests, Playwright hero
flow, database migration from clean state, import fixture verification, prompt
preview verification, external-model permission denial verification, memory
delete verification, and timeline audit verification.

- [ ] **Step 3: Update README**

README should link to the design spec, implementation blueprint, runbook, and
release checklist. It should state that Future is docs-first until Task 1 begins
and implementation-ready after this blueprint.

- [ ] **Step 4: Run final verification**

Run: `pnpm install`

Expected: dependencies install successfully.

Run: `pnpm check`

Expected: typecheck, lint, and unit tests pass.

Run: `pnpm test:e2e`

Expected: Playwright hero-flow test passes.

- [ ] **Step 5: Commit**

```bash
git add README.md docs
git commit -m "docs: add future build runbook and release checklist"
```

## Completion Criteria

The MVP implementation is complete when all of these are true:

- A fresh clone can run `pnpm install`, `pnpm check`, and `pnpm test:e2e`.
- The local web app starts and shows the command center as the first screen.
- The API creates workspaces and stores timeline events in SQLite.
- The app imports Markdown, plain text, and ChatGPT export fixtures.
- Imported content is searchable through SQLite FTS5.
- Memory proposals can be approved, edited, deleted, pinned, and inspected.
- The mock provider can complete the first hero command without external API
  access.
- External model calls require permission and prompt preview by default.
- Context packs show source citations and redactions before calls.
- Timeline records exist for imports, memory changes, context packs, model
  calls, permission decisions, and assistant responses.
- README, runbook, and release checklist match the shipped workflow.
