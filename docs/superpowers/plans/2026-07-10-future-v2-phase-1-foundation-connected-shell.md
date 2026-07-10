# Future V2 Phase 1 Foundation and Connected Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V2 foundation and replace the static browser shell with a real local setup experience backed by versioned SQLite migrations, protected V2 API contracts, persisted providers and model profiles, and typed browser/API communication.

**Architecture:** Keep the existing pnpm modular monolith. Add versioned migrations and focused repositories in `@future/db`, shared V2 DTOs in `@future/core`, orchestration and local-session enforcement in `apps/api`, and an injected typed API client in `apps/web`. Preserve existing `/api` behavior while introducing `/api/v2` routes so later continuous-assistant phases can migrate incrementally.

**Tech Stack:** TypeScript 6, Node.js 24+, pnpm 11.9.0, Fastify 5, React 19, Vite 8, SQLite/better-sqlite3, Vitest 4, Testing Library, Playwright 1.61.1.

## Global Constraints

- Work on branch `v2`; do not modify `main` during implementation.
- Preserve existing MVP data and existing `/api` routes.
- Bind the API to `127.0.0.1`; do not add permissive CORS.
- Keep secrets out of SQLite payloads, logs, timeline events, browser responses, and tests.
- Use Fastify schemas with `additionalProperties: false` for V2 mutation bodies.
- Follow test-driven development: failing test, minimal implementation, passing test, then commit.
- Do not introduce a state-management or data-fetching dependency in Phase 1.
- Run `corepack pnpm check` and `corepack pnpm test:e2e` before Phase 1 completion.

---

## File Structure Map

### Database migration and repositories

- Create `packages/db/src/migrations/types.ts`: migration contract.
- Create `packages/db/src/migrations/0001-initial.ts`: idempotent baseline migration using the existing schema statements.
- Create `packages/db/src/migrations/runner.ts`: migration table, checksum verification, ordered application.
- Create `packages/db/src/migrations/runner.test.ts`: clean and existing-database migration coverage.
- Create `packages/db/src/repositories/providers.ts`: provider configuration persistence without secret values.
- Create `packages/db/src/repositories/model-profiles.ts`: model-profile persistence.
- Create repository tests beside each repository.
- Modify `packages/db/src/connection.ts`: run migrations on open.
- Modify `packages/db/src/index.ts`: export migrations and repositories.

### Shared contracts

- Create `packages/core/src/api.ts`: V2 error and session DTOs.
- Expand `packages/core/src/providers.ts`: persisted provider and model-profile contracts.
- Modify `packages/core/src/index.ts`: export V2 contracts.
- Add tests for contract helpers where runtime behavior exists.

### Local API foundation

- Create `apps/api/src/server/api-errors.ts`: stable error envelope and Fastify error mapping.
- Create `apps/api/src/server/local-session.ts`: V2 session endpoint and mutation-token enforcement.
- Create `apps/api/src/services/provider-service.ts`: persisted provider/model profile orchestration and runtime adapter creation.
- Create `apps/api/src/routes/v2/health.ts`: V2 health endpoint with migration state.
- Create `apps/api/src/routes/v2/workspaces.ts`: V2 workspace list/create routes.
- Create `apps/api/src/routes/v2/providers.ts`: V2 provider and model-profile routes.
- Create focused tests for each route/service.
- Modify `apps/api/src/server/dependencies.ts`: inject repositories and provider service.
- Modify `apps/api/src/server/create-server.ts`: configure session, errors, and V2 routes.
- Modify `apps/api/src/index.ts`: create and pass the startup session token.

### Browser connection and setup UI

- Create `apps/web/vite.config.ts`: proxy `/api` to the local API.
- Create `apps/web/src/app/api-types.ts`: web-facing aliases for shared DTOs.
- Rewrite `apps/web/src/app/api-client.ts`: lazy local session and typed requests.
- Create `apps/web/src/app/use-bootstrap.ts`: initial workspace/provider loading state.
- Create `apps/web/src/features/setup/FirstRunSetup.tsx`: first workspace and provider forms.
- Rewrite `WorkspaceSwitcher.tsx`: render live workspaces and selection.
- Rewrite `apps/web/src/app/App.tsx`: connected loading/error/setup/shell states.
- Expand React and Playwright tests to create data through the browser.

---

### Task 1: Versioned SQLite Migration Runner

**Files:**
- Create: `packages/db/src/migrations/types.ts`
- Create: `packages/db/src/migrations/0001-initial.ts`
- Create: `packages/db/src/migrations/runner.ts`
- Test: `packages/db/src/migrations/runner.test.ts`
- Modify: `packages/db/src/connection.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: existing `schemaStatements: readonly string[]` from `packages/db/src/schema.ts`.
- Produces: `Migration`, `MigrationRecord`, `migrations`, and `runMigrations(db): MigrationRecord[]`.

- [ ] **Step 1: Write failing migration tests**

```ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { schemaStatements } from "../schema";
import { runMigrations } from "./runner";

describe("runMigrations", () => {
  it("applies the baseline exactly once", () => {
    const db = new Database(":memory:");
    try {
      expect(runMigrations(db).map((row) => row.id)).toEqual(["0001_initial"]);
      expect(runMigrations(db).map((row) => row.id)).toEqual(["0001_initial"]);
      const rows = db.prepare("SELECT id FROM schema_migrations").all();
      expect(rows).toEqual([{ id: "0001_initial" }]);
    } finally {
      db.close();
    }
  });

  it("adopts an existing MVP schema without deleting data", () => {
    const db = new Database(":memory:");
    try {
      for (const statement of schemaStatements) db.exec(statement);
      db.prepare(`INSERT INTO workspaces (
        id, name, kind, privacy_mode, created_at, updated_at
      ) VALUES (?, ?, 'project', 'standard', ?, ?)`)
        .run("w_existing", "Existing", "2026-07-10T00:00:00.000Z", "2026-07-10T00:00:00.000Z");
      runMigrations(db);
      expect(db.prepare("SELECT name FROM workspaces WHERE id = ?").pluck().get("w_existing"))
        .toBe("Existing");
    } finally {
      db.close();
    }
  });
});
```

- [ ] **Step 2: Run the migration test and verify red**

Run: `corepack pnpm --filter @future/db test -- src/migrations/runner.test.ts`

Expected: FAIL because `./runner` does not exist.

- [ ] **Step 3: Add the migration contract and baseline**

```ts
// packages/db/src/migrations/types.ts
import type { SqliteDatabase } from "../connection";

export interface Migration {
  id: string;
  checksum: string;
  up(db: SqliteDatabase): void;
}

export interface MigrationRecord {
  id: string;
  checksum: string;
  appliedAt: string;
}
```

```ts
// packages/db/src/migrations/0001-initial.ts
import { createHash } from "node:crypto";
import { schemaStatements } from "../schema";
import type { Migration } from "./types";

const checksum = createHash("sha256").update(schemaStatements.join("\n")).digest("hex");

export const initialMigration: Migration = {
  id: "0001_initial",
  checksum,
  up(db) {
    for (const statement of schemaStatements) db.exec(statement);
  }
};
```

- [ ] **Step 4: Implement ordered, checksum-verified migration execution**

```ts
// packages/db/src/migrations/runner.ts
import type { SqliteDatabase } from "../connection";
import { initialMigration } from "./0001-initial";
import type { Migration, MigrationRecord } from "./types";

export const migrations: readonly Migration[] = [initialMigration];

export function runMigrations(db: SqliteDatabase): MigrationRecord[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const apply = db.transaction(() => {
    for (const migration of migrations) {
      const row = db.prepare("SELECT checksum FROM schema_migrations WHERE id = ?")
        .get(migration.id) as { checksum: string } | undefined;
      if (row && row.checksum !== migration.checksum) {
        throw new Error(`Migration checksum mismatch: ${migration.id}`);
      }
      if (row) continue;
      migration.up(db);
      db.prepare(
        "INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (?, ?, ?)"
      ).run(migration.id, migration.checksum, new Date().toISOString());
    }
  });
  apply();

  return db.prepare(
    "SELECT id, checksum, applied_at AS appliedAt FROM schema_migrations ORDER BY id"
  ).all() as MigrationRecord[];
}
```

- [ ] **Step 5: Route database startup through migrations**

Replace `initializeSchema(db)` in `openDatabase` with `runMigrations(db)`. Keep
`initializeSchema` as a deprecated compatibility wrapper that calls
`runMigrations`, then export `./migrations/runner` and `./migrations/types` from
`packages/db/src/index.ts`.

- [ ] **Step 6: Run database tests and verify green**

Run: `corepack pnpm --filter @future/db test`

Expected: all database test files pass, including two migration tests.

- [ ] **Step 7: Commit the migration runner**

```powershell
git add packages/db/src
git commit -m "feat: add versioned database migrations"
```

---

### Task 2: Shared V2 API Contracts and Error Envelope

**Files:**
- Create: `packages/core/src/api.ts`
- Test: `packages/core/src/api.test.ts`
- Modify: `packages/core/src/providers.ts`
- Modify: `packages/core/src/index.ts`
- Create: `apps/api/src/server/api-errors.ts`
- Test: `apps/api/src/server/api-errors.test.ts`
- Modify: `apps/api/src/server/create-server.ts`

**Interfaces:**
- Consumes: Fastify validation errors.
- Produces: `ApiErrorCode`, `ApiErrorResponse`, `LocalSessionResponse`,
  `ProviderConfig`, `ModelProfile`, `sendApiError`, and `registerApiErrorHandler`.

- [ ] **Step 1: Write failing core contract and API error tests**

```ts
// packages/core/src/api.test.ts
import { describe, expect, it } from "vitest";
import { apiError } from "./api";

describe("apiError", () => {
  it("creates the stable V2 error envelope", () => {
    expect(apiError("validation_error", "Invalid request", "req_1", { name: "required" }))
      .toEqual({ error: { code: "validation_error", message: "Invalid request", requestId: "req_1", details: { name: "required" } } });
  });
});
```

```ts
// apps/api/src/server/api-errors.test.ts
import { describe, expect, it } from "vitest";
import { createServer } from "./create-server";

describe("V2 API errors", () => {
  it("wraps schema failures in the stable envelope", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const response = await server.inject({ method: "POST", url: "/api/workspaces", payload: {} });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: expect.objectContaining({ code: "validation_error", requestId: expect.any(String) }) });
    await server.close();
  });
});
```

- [ ] **Step 2: Run focused tests and verify red**

Run: `corepack pnpm --filter @future/core test -- src/api.test.ts`

Expected: FAIL because `api.ts` does not exist.

Run: `corepack pnpm --filter @future/api test -- src/server/api-errors.test.ts`

Expected: FAIL because the existing schema failure is not yet mapped to the V2 error envelope.

- [ ] **Step 3: Implement shared DTOs**

```ts
// packages/core/src/api.ts
export type ApiErrorCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "internal_error";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

export interface LocalSessionResponse { token: string; }

export interface WorkspaceDto {
  id: string;
  name: string;
  kind: string;
  privacyMode: "standard" | "local_only";
  rootPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceInput {
  name: string;
  kind?: string;
  privacyMode: "standard" | "local_only";
  rootPath?: string;
}

export interface CreateProviderInput {
  kind: "mock" | "ollama" | "openai-compatible";
  displayName: string;
  baseUrl?: string;
  secretEnvironmentVariable?: string;
  isLocal: boolean;
}

export interface ProviderConfig {
  id: string;
  kind: "mock" | "ollama" | "openai-compatible";
  displayName: string;
  baseUrl?: string;
  isLocal: boolean;
  hasSecret: boolean;
  capabilities: { streaming: boolean; text: boolean; embeddings: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelProfileInput {
  providerId: string;
  name: string;
  model: string;
  contextWindow: number;
  purpose: string;
  temperature?: number;
  privacyPolicy: "local_only" | "prompt_preview";
}

export interface ModelProfile extends CreateModelProfileInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  return { error: { code, message, requestId, ...(details ? { details } : {}) } };
}
```

Add persisted `ProviderConfig` and `ModelProfile` interfaces to
`packages/core/src/providers.ts`, using ISO strings for serialized dates and a
`hasSecret: boolean` field instead of returning `apiKeyRef` to the browser.

- [ ] **Step 4: Implement Fastify error mapping**

```ts
// apps/api/src/server/api-errors.ts
import { apiError, type ApiErrorCode } from "@future/core";
import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";

export function sendApiError(reply: FastifyReply, status: number, code: ApiErrorCode, message: string) {
  return reply.code(status).send(apiError(code, message, reply.request.id));
}

export function registerApiErrorHandler(server: FastifyInstance): void {
  server.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply.code(400).send(apiError("validation_error", "Invalid request", request.id));
    }
    request.log.error({ err: error }, "request failed");
    return reply.code(500).send(apiError("internal_error", "Request failed", request.id));
  });
}
```

Register the error handler before routes in `createServer`.

- [ ] **Step 5: Run core and API tests**

Run: `corepack pnpm --filter @future/core test && corepack pnpm --filter @future/api test`

Expected: all core and API tests pass.

- [ ] **Step 6: Commit V2 contracts**

```powershell
git add packages/core/src apps/api/src/server
git commit -m "feat: add v2 api contracts"
```

---

### Task 3: Local Session Protection and Vite Proxy

**Files:**
- Create: `apps/api/src/server/local-session.ts`
- Test: `apps/api/src/server/local-session.test.ts`
- Modify: `apps/api/src/server/create-server.ts`
- Modify: `apps/api/src/index.ts`
- Create: `apps/web/vite.config.ts`
- Modify: `apps/web/src/app/api-client.ts`
- Test: `apps/web/src/app/api-client.test.ts`

**Interfaces:**
- Consumes: `LocalSessionResponse` and V2 error envelope.
- Produces: `registerLocalSession(server, token, allowedOrigins)` and a lazy,
  cached local-session token inside `ApiClient` plus a private authenticated
  `request` method for V2 mutations.

- [ ] **Step 1: Write failing local-session tests**

```ts
import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerApiErrorHandler } from "./api-errors";
import { registerLocalSession } from "./local-session";

describe("local V2 session", () => {
  it("rejects V2 mutations without the session token", async () => {
    const server = Fastify();
    registerApiErrorHandler(server);
    await registerLocalSession(server, "test-token", ["http://127.0.0.1:4173"]);
    server.post("/api/v2/test-mutation", async () => ({ ok: true }));
    const response = await server.inject({ method: "POST", url: "/api/v2/test-mutation" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: expect.objectContaining({ code: "unauthorized" }) });
    await server.close();
  });

  it("returns the startup token from the same-origin session endpoint", async () => {
    const server = Fastify();
    await registerLocalSession(server, "test-token", ["http://127.0.0.1:4173"]);
    const response = await server.inject({ method: "GET", url: "/api/v2/session" });
    expect(response.json()).toEqual({ token: "test-token" });
    await server.close();
  });

  it("rejects a mutation from an unrelated browser origin", async () => {
    const server = Fastify();
    registerApiErrorHandler(server);
    await registerLocalSession(server, "test-token", ["http://127.0.0.1:4173"]);
    server.post("/api/v2/test-mutation", async () => ({ ok: true }));
    const response = await server.inject({
      method: "POST",
      url: "/api/v2/test-mutation",
      headers: { origin: "https://unrelated.example", "x-future-session": "test-token" }
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: expect.objectContaining({ code: "forbidden" }) });
    await server.close();
  });
});
```

- [ ] **Step 2: Run the session test and verify red**

Run: `corepack pnpm --filter @future/api test -- src/server/local-session.test.ts`

Expected: FAIL because the V2 session route is missing.

- [ ] **Step 3: Implement local-session enforcement**

```ts
// apps/api/src/server/local-session.ts
import { apiError } from "@future/core";
import type { FastifyInstance } from "fastify";

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function registerLocalSession(
  server: FastifyInstance,
  token: string,
  allowedOrigins: readonly string[]
): Promise<void> {
  server.get("/api/v2/session", async () => ({ token }));
  server.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/v2/") || !mutationMethods.has(request.method)) return;
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      return reply.code(403).send(apiError("forbidden", "Origin not allowed", request.id));
    }
    if (request.headers["x-future-session"] === token) return;
    return reply.code(401).send(apiError("unauthorized", "Local session required", request.id));
  });
}
```

Add `sessionToken?: string` and `allowedOrigins?: readonly string[]` to
`CreateServerOptions`; default them to a random UUID and
`["http://127.0.0.1:4173"]` for embedded callers. Generate one token in
`apps/api/src/index.ts` and pass it to `createServer`.

- [ ] **Step 4: Add the Vite proxy**

```ts
// apps/web/vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    proxy: { "/api": "http://127.0.0.1:4174" }
  }
});
```

- [ ] **Step 5: Write failing API-client session tests**

Mock `fetch` and assert that the first mutation calls `/api/v2/session`, then sends
`x-future-session: test-token` to `/api/v2/workspaces`. Assert a second mutation
reuses the cached token.

- [ ] **Step 6: Implement authenticated V2 client requests**

```ts
private sessionToken?: string;

private async getSessionToken(): Promise<string> {
  if (this.sessionToken) return this.sessionToken;
  const response = await fetch(`${this.baseUrl}/v2/session`);
  if (!response.ok) throw await ApiClient.toError(response);
  this.sessionToken = ((await response.json()) as LocalSessionResponse).token;
  return this.sessionToken;
}

private async mutate<T>(path: string, body: unknown): Promise<T> {
  const token = await this.getSessionToken();
  const response = await fetch(`${this.baseUrl}/v2${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-future-session": token },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw await ApiClient.toError(response);
  return (await response.json()) as T;
}
```

- [ ] **Step 7: Run API and web tests**

Run: `corepack pnpm --filter @future/api test && corepack pnpm --filter @future/web test`

Expected: all API and web tests pass.

- [ ] **Step 8: Commit local browser/API protection**

```powershell
git add apps/api/src apps/web/vite.config.ts apps/web/src/app
git commit -m "feat: protect v2 local api sessions"
```

---

### Task 4: Provider and Model Profile Repositories

**Files:**
- Create: `packages/db/src/repositories/providers.ts`
- Test: `packages/db/src/repositories/providers.test.ts`
- Create: `packages/db/src/repositories/model-profiles.ts`
- Test: `packages/db/src/repositories/model-profiles.test.ts`
- Modify: `packages/db/src/index.ts`
- Create: `apps/api/src/services/provider-service.ts`
- Test: `apps/api/src/services/provider-service.test.ts`
- Modify: `apps/api/src/server/dependencies.ts`
- Modify: `apps/api/src/server/create-server.ts`

**Interfaces:**
- Consumes: existing `providers` and `model_profiles` tables plus provider adapters.
- Produces: `ProviderRepository`, `ModelProfileRepository`, and
  `ProviderService.getRuntime(profileId): { provider: ModelProvider; profile: ModelProfile }`.

- [ ] **Step 1: Write failing repository tests**

Create a temporary in-memory database, insert an Ollama provider and profile through
the repositories, then assert list/get round trips preserve IDs, model, context
window, local classification, and timestamps while returning only `hasSecret`.

```ts
const provider = providers.create({ kind: "ollama", displayName: "Local Ollama", baseUrl: "http://127.0.0.1:11434", isLocal: true });
const profile = profiles.create({ providerId: provider.id, name: "Local default", model: "llama3.2", contextWindow: 8192, purpose: "general", privacyPolicy: "local_only" });
expect(profiles.get(profile.id)).toEqual(profile);
expect(providers.get(provider.id)).toEqual(expect.objectContaining({ hasSecret: false }));
```

- [ ] **Step 2: Run repository tests and verify red**

Run: `corepack pnpm --filter @future/db test -- src/repositories/providers.test.ts src/repositories/model-profiles.test.ts`

Expected: FAIL because both repositories are missing.

- [ ] **Step 3: Implement focused repositories**

Each repository accepts `SqliteDatabase` in its constructor, owns SQL and row
mapping, generates IDs with `createId`, and exposes only these methods:

```ts
class ProviderRepository {
  list(): ProviderConfig[];
  get(id: string): ProviderConfig | undefined;
  create(input: CreateProviderInput): ProviderConfig;
}

class ModelProfileRepository {
  list(providerId?: string): ModelProfile[];
  get(id: string): ModelProfile | undefined;
  create(input: CreateModelProfileInput): ModelProfile;
}
```

Store `apiKeyRef` internally but map it to `hasSecret`. Do not expose the reference
from repository response types.

- [ ] **Step 4: Write failing ProviderService tests**

Test that a mock profile resolves to `MockProvider`, an Ollama profile uses the
persisted base URL and model, and an unknown profile throws a typed not-found error.

- [ ] **Step 5: Implement ProviderService**

```ts
export class ProviderService {
  constructor(
    private readonly providers: ProviderRepository,
    private readonly profiles: ModelProfileRepository
  ) {}

  getRuntime(profileId: string): { provider: ModelProvider; profile: ModelProfile } {
    const profile = this.profiles.get(profileId);
    if (!profile) throw new ProviderServiceError("model_profile_not_found");
    const config = this.providers.get(profile.providerId);
    if (!config) throw new ProviderServiceError("provider_not_found");
    if (config.kind === "mock") return { provider: new MockProvider(), profile };
    if (config.kind === "ollama") {
      return {
        provider: new OllamaProvider({
          id: config.id,
          ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
          model: profile.model
        }),
        profile
      };
    }
    throw new ProviderServiceError("secret_store_not_configured");
  }
}
```

OpenAI-compatible execution remains blocked until the Phase 4 secret-store slice;
configuration records can still be created in Phase 1.

- [ ] **Step 6: Inject repositories and service**

Add `providers`, `modelProfiles`, and `providerService` to `ApiDependencies` and
construct them once in `createServer`.

- [ ] **Step 7: Run database and API tests**

Run: `corepack pnpm --filter @future/db test && corepack pnpm --filter @future/api test`

Expected: repository and ProviderService tests pass with all existing tests.

- [ ] **Step 8: Commit persisted provider runtime**

```powershell
git add packages/db/src apps/api/src/services apps/api/src/server
git commit -m "feat: persist provider model profiles"
```

---

### Task 5: V2 Workspace, Provider, and Model Profile Routes

**Files:**
- Create: `apps/api/src/routes/v2/health.ts`
- Create: `apps/api/src/routes/v2/workspaces.ts`
- Test: `apps/api/src/routes/v2/workspaces.test.ts`
- Create: `apps/api/src/routes/v2/providers.ts`
- Test: `apps/api/src/routes/v2/providers.test.ts`
- Modify: `apps/api/src/server/create-server.ts`

**Interfaces:**
- Consumes: repositories from Task 4 and the session/error contracts from Tasks 2-3.
- Produces: `/api/v2/health`, `/api/v2/workspaces`, `/api/v2/providers`, and
  `/api/v2/model-profiles` list/create endpoints.

- [ ] **Step 1: Write failing V2 route tests**

Test these flows through `server.inject` with `x-future-session: test-token`:

```ts
POST /api/v2/workspaces -> 201 and workspace.created event
GET  /api/v2/workspaces -> created workspace in list
POST /api/v2/providers -> 201 with hasSecret and no apiKeyRef
POST /api/v2/model-profiles -> 201 linked to provider
GET  /api/v2/model-profiles?providerId=... -> created profile
```

Also assert unsupported provider kinds, unknown provider IDs, empty model names,
and extra mutation properties return the stable `validation_error` or `not_found`
envelope.

- [ ] **Step 2: Run V2 route tests and verify red**

Run: `corepack pnpm --filter @future/api test -- src/routes/v2`

Expected: FAIL because the V2 route modules do not exist.

- [ ] **Step 3: Implement V2 health and workspace routes**

Use the existing workspace transaction and event semantics, but return shared DTOs
under `/api/v2`. The health response is:

```ts
{ ok: true, apiVersion: "v2", database: { migrationCount: number } }
```

- [ ] **Step 4: Implement provider and model-profile routes**

Provider body schema:

```ts
{
  type: "object",
  required: ["kind", "displayName", "isLocal"],
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["mock", "ollama", "openai-compatible"] },
    displayName: { type: "string", minLength: 1 },
    baseUrl: { type: "string", minLength: 1 },
    secretEnvironmentVariable: { type: "string", pattern: "^[A-Z][A-Z0-9_]*$" },
    isLocal: { type: "boolean" }
  }
}
```

Map `secretEnvironmentVariable` to an internal `env:<NAME>` reference. Return only
`hasSecret` to the browser. Validate that model-profile provider IDs exist before
inserting.

- [ ] **Step 5: Register V2 routes**

Register session protection first, then V2 health, workspaces, providers, and model
profiles. Keep all existing MVP route registration unchanged.

- [ ] **Step 6: Run all API tests**

Run: `corepack pnpm --filter @future/api test`

Expected: all legacy and V2 API tests pass.

- [ ] **Step 7: Commit V2 setup API**

```powershell
git add apps/api/src/routes/v2 apps/api/src/server/create-server.ts
git commit -m "feat: add v2 setup api"
```

---

### Task 6: Connected First-Run Browser Shell

**Files:**
- Create: `apps/web/src/app/api-types.ts`
- Modify: `apps/web/src/app/api-client.ts`
- Create: `apps/web/src/app/use-bootstrap.ts`
- Test: `apps/web/src/app/use-bootstrap.test.tsx`
- Create: `apps/web/src/features/setup/FirstRunSetup.tsx`
- Test: `apps/web/src/features/setup/FirstRunSetup.test.tsx`
- Modify: `apps/web/src/features/workspaces/WorkspaceSwitcher.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/src/styles/global.css`
- Modify: `tests/e2e/hero-flow.spec.ts`

**Interfaces:**
- Consumes: V2 setup routes and shared DTOs.
- Produces: a real loading/error/first-run/ready state and browser-created workspace,
  provider, and model profile.

- [ ] **Step 1: Write failing API client and bootstrap tests**

Inject an `ApiClient` into `App`. Mock its methods and assert:

- loading state appears before initial requests resolve
- first-run setup appears when any required workspace, provider, or model profile is missing
- ready shell shows live workspace and model-profile names
- API errors show a retry action and do not fabricate demo data

Use this client surface:

```ts
interface FutureApi {
  listWorkspaces(): Promise<{ workspaces: WorkspaceDto[] }>;
  createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceDto>;
  listProviders(): Promise<{ providers: ProviderConfig[] }>;
  createProvider(input: CreateProviderInput): Promise<ProviderConfig>;
  listModelProfiles(providerId?: string): Promise<{ modelProfiles: ModelProfile[] }>;
  createModelProfile(input: CreateModelProfileInput): Promise<ModelProfile>;
}
```

- [ ] **Step 2: Run web tests and verify red**

Run: `corepack pnpm --filter @future/web test`

Expected: FAIL because the connected bootstrap and setup components do not exist.

- [ ] **Step 3: Implement typed API methods and bootstrap hook**

`useBootstrap(api)` returns:

```ts
type BootstrapState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; workspaces: WorkspaceDto[]; providers: ProviderConfig[]; modelProfiles: ModelProfile[] };
```

Load the three resource lists in parallel. Expose `reload()` after successful setup
or a recoverable error.

- [ ] **Step 4: Implement FirstRunSetup**

The setup component contains two explicit steps:

1. Workspace name and privacy mode (`standard` or `local_only`).
2. Provider type, display name, base URL when applicable, model name, and context
   window.

Use existing bootstrap records to skip completed steps. Submit workspace first,
provider second, and model profile third only when each resource is missing. Disable
duplicate submissions, retain form values after errors, and call `onComplete` only
after all three records exist.

- [ ] **Step 5: Replace static App data with connected state**

Keep the command-center layout, but remove hard-coded `Future Demo`, `Model: Mock`,
and fake event counts. Render:

- loading panel
- recoverable local API error panel
- `FirstRunSetup` whenever the workspace/provider/profile setup is incomplete
- live `WorkspaceSwitcher`, selected model profile, and empty real timeline state

The command palette remains visible but disabled actions say "Available after setup"
until Phase 2 connects assistant turns.

- [ ] **Step 6: Run web tests and verify green**

Run: `corepack pnpm --filter @future/web test`

Expected: API client, setup, bootstrap, and App tests all pass.

- [ ] **Step 7: Convert the Playwright hero flow to browser-driven setup**

In `tests/e2e/hero-flow.spec.ts`, remove direct workspace/provider setup calls. Use
the visible form to create a unique workspace, select the mock provider, create a
model profile, and assert the workspace/model names appear in the connected shell.
Keep the existing API-driven import/memory/command assertions temporarily in a
second test until Phase 2 exposes those flows in the browser.

- [ ] **Step 8: Install the pinned browser and run Playwright**

Run: `corepack pnpm exec playwright install chromium`

Expected: Playwright Chromium revision required by 1.61.1 is installed.

Run: `corepack pnpm test:e2e`

Expected: connected setup flow and legacy backend hero flow pass in Chromium.

- [ ] **Step 9: Commit the connected shell**

```powershell
git add apps/web tests/e2e
git commit -m "feat: connect v2 first run shell"
```

---

### Task 7: Phase 1 Documentation and Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/10-build-runbook.md`
- Modify: `docs/11-release-checklist.md`
- Create: `docs/context.md`

**Interfaces:**
- Consumes: completed Phase 1 commands, environment variables, and browser flow.
- Produces: current contributor orientation and reproducible verification steps.

- [ ] **Step 1: Update contributor-facing documentation**

Document:

- V2 branch and Phase 1 status
- local API/web startup
- `FUTURE_DB_PATH`, `PORT`, and secret environment references
- migration behavior and reset command
- first-run workspace/provider/model setup
- full verification sequence
- architecture map and the next Phase 2 boundary in `docs/context.md`

- [ ] **Step 2: Run formatting and diff checks**

Run: `git diff --check`

Expected: exit code 0.

- [ ] **Step 3: Run the complete workspace gate**

Run: `corepack pnpm check`

Expected: typecheck, lint, and every unit/integration test pass.

- [ ] **Step 4: Build the production web bundle**

Run: `corepack pnpm --filter @future/web build`

Expected: Vite exits 0 and writes `apps/web/dist`.

- [ ] **Step 5: Run browser verification**

Run: `corepack pnpm test:e2e`

Expected: all Chromium tests pass through the local API and web processes.

- [ ] **Step 6: Verify repository state**

Run: `git status --short --branch`

Expected: only intended documentation changes are uncommitted.

- [ ] **Step 7: Commit Phase 1 documentation**

```powershell
git add README.md docs
git commit -m "docs: document v2 foundation workflow"
```

- [ ] **Step 8: Record the Phase 1 checkpoint**

Run:

```powershell
git status --short --branch
git log --oneline --decorate -8
```

Expected: clean `v2` worktree with one focused commit per task and all verification
commands recorded in the handoff.
