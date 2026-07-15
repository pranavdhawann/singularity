# Plan 1 — Safety & Providers Backbone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native Anthropic/OpenAI providers with a settings-entered API key, and replace external-only redaction with an always-on, pluggable PII engine that auto-masks low-risk PII and pauses only on high-risk (mode C).

**Architecture:** Extend the existing `ModelProvider`/`ProviderRegistry` pattern with two cloud providers plus a local `SecretStore`. Introduce a `RedactionEngine` interface in `@future/permissions` with a Node-only default (regex now, optional ONNX ML slot). Rewire the assistant turn lifecycle so redaction runs on every outbound turn as a boundary filter.

**Tech Stack:** TypeScript, pnpm workspaces, Fastify, better-sqlite3, Vitest. Providers use `fetch` + SSE parsing (mirrors `packages/providers/src/openai-compatible.ts`).

**Model assignments (subagent dispatch):**

| Task                                  | Unit | Model      | Why                                          |
| ------------------------------------- | ---- | ---------- | -------------------------------------------- |
| 1 SecretStore                         | A    | **Haiku**  | Small, well-specified file CRUD              |
| 2 ProviderKind + Anthropic provider   | A    | **Sonnet** | Novel SSE format + API shape                 |
| 3 Native OpenAI provider              | A    | **Haiku**  | Thin wrapper over existing openai-compatible |
| 4 Provider-service wiring             | A    | **Sonnet** | Touches DI + secret resolution               |
| 5 Redaction types + risk map          | B    | **Haiku**  | Pure data/types                              |
| 6 Node regex recognizers              | B    | **Sonnet** | Correctness-critical (Luhn, false positives) |
| 7 RedactionEngine interface + ML slot | B    | **Sonnet** | Interface design + graceful degradation      |
| 8 Mode-C turn integration             | C    | **Sonnet** | Critical lifecycle refactor                  |

**Prerequisite:** Work on branch `feat/v2-chat-first-memory`. Run `CI=true corepack pnpm install --frozen-lockfile` once; if `better-sqlite3` reports an unbuilt binding, run `node node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/node_modules/.bin/../../../better-sqlite3/*` — simplest: `cd` into the better-sqlite3 package dir and run `npm run install`. Verify each task with `CI=true corepack pnpm --filter <pkg> exec vitest run <file>`.

---

## Task 1: SecretStore (local secret file)

**Files:**

- Create: `packages/core/src/secrets.ts`
- Modify: `packages/core/src/index.ts`
- Create: `apps/api/src/services/secret-store.ts`
- Test: `apps/api/src/services/secret-store.test.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Add the contract to `packages/core/src/secrets.ts`**

```ts
export interface SecretStore {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
  list(): string[];
}
```

- [ ] **Step 2: Export it from `packages/core/src/index.ts`**

Add this line alongside the other `export *` lines:

```ts
export * from "./secrets";
```

- [ ] **Step 3: Write the failing test `apps/api/src/services/secret-store.test.ts`**

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileSecretStore } from "./secret-store";

describe("FileSecretStore", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "future-secrets-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("stores and reads a secret by name", () => {
    const store = new FileSecretStore(join(dir, "secrets.json"));
    store.set("FUTURE_ANTHROPIC_API_KEY", "sk-ant-123");
    expect(store.get("FUTURE_ANTHROPIC_API_KEY")).toBe("sk-ant-123");
    expect(store.list()).toEqual(["FUTURE_ANTHROPIC_API_KEY"]);
  });

  it("persists across instances and returns undefined for missing", () => {
    const path = join(dir, "secrets.json");
    new FileSecretStore(path).set("A", "1");
    expect(new FileSecretStore(path).get("A")).toBe("1");
    expect(new FileSecretStore(path).get("MISSING")).toBeUndefined();
  });

  it("prefers process.env over the file when present", () => {
    const store = new FileSecretStore(join(dir, "secrets.json"));
    store.set("FROM_ENV", "file-value");
    process.env.FROM_ENV = "env-value";
    try {
      expect(store.get("FROM_ENV")).toBe("env-value");
    } finally {
      delete process.env.FROM_ENV;
    }
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `CI=true corepack pnpm --filter @future/api exec vitest run src/services/secret-store.test.ts`
Expected: FAIL — `Cannot find module './secret-store'`.

- [ ] **Step 5: Implement `apps/api/src/services/secret-store.ts`**

```ts
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SecretStore } from "@future/core";

export class FileSecretStore implements SecretStore {
  constructor(private readonly path: string) {}

  get(name: string): string | undefined {
    if (process.env[name]) return process.env[name];
    return this.read()[name];
  }

  set(name: string, value: string): void {
    const data = this.read();
    data[name] = value;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(data, null, 2), { mode: 0o600 });
    try {
      chmodSync(this.path, 0o600);
    } catch {
      // best-effort on platforms without POSIX modes
    }
  }

  list(): string[] {
    return Object.keys(this.read());
  }

  private read(): Record<string, string> {
    if (!existsSync(this.path)) return {};
    try {
      return JSON.parse(readFileSync(this.path, "utf8")) as Record<string, string>;
    } catch {
      return {};
    }
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `CI=true corepack pnpm --filter @future/api exec vitest run src/services/secret-store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Ignore the secret file in `.gitignore`**

Add this line under the existing `.future/` related entries:

```
.future/secrets.json
```

- [ ] **Step 8: Typecheck and commit**

```bash
CI=true corepack pnpm --filter @future/core --filter @future/api typecheck
git add packages/core/src/secrets.ts packages/core/src/index.ts apps/api/src/services/secret-store.ts apps/api/src/services/secret-store.test.ts .gitignore
git commit -m "feat(secrets): add local FileSecretStore with env override"
```

---

## Task 2: ProviderKind extension + Anthropic provider

**Files:**

- Modify: `packages/core/src/providers.ts:1`
- Create: `packages/providers/src/anthropic.ts`
- Modify: `packages/providers/src/index.ts`
- Test: `packages/providers/src/anthropic.test.ts`

- [ ] **Step 1: Widen `ProviderKind` in `packages/core/src/providers.ts:1`**

Replace line 1:

```ts
export type ProviderKind = "openai-compatible" | "ollama" | "mock" | "anthropic" | "openai";
```

- [ ] **Step 2: Write the failing test `packages/providers/src/anthropic.test.ts`**

The Anthropic Messages streaming API emits SSE `event:`/`data:` pairs; text lives in `content_block_delta` frames with `delta.type === "text_delta"`. The test feeds a canned stream through a stubbed `fetch`.

```ts
import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "./anthropic";

function sseResponse(frames: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const f of frames) controller.enqueue(enc.encode(f));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe("AnthropicProvider", () => {
  it("streams text_delta content from the messages endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse([
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AnthropicProvider({
      id: "anthropic_1",
      apiKey: "sk-ant-test",
      models: [{ id: "claude-sonnet-5", displayName: "Claude Sonnet 5", contextWindow: 200000 }],
    });

    const out: string[] = [];
    for await (const chunk of provider.streamText({ prompt: "hi", model: "claude-sonnet-5" })) {
      out.push(chunk.text);
    }
    expect(out.join("")).toBe("Hello");

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      "x-api-key": "sk-ant-test",
      "anthropic-version": "2023-06-01",
    });
    vi.unstubAllGlobals();
  });

  it("throws a typed error on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    );
    const provider = new AnthropicProvider({ id: "a", apiKey: "k", models: [] });
    await expect(async () => {
      for await (const _ of provider.streamText({ prompt: "x", model: "claude-sonnet-5" }));
    }).rejects.toThrow("Anthropic provider request failed");
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `CI=true corepack pnpm --filter @future/providers exec vitest run src/anthropic.test.ts`
Expected: FAIL — `Cannot find module './anthropic'`.

- [ ] **Step 4: Implement `packages/providers/src/anthropic.ts`**

```ts
import type { ModelDescriptor, ModelProvider, ModelTextChunk, ModelTextRequest } from "./types";

export interface AnthropicProviderOptions {
  id: string;
  apiKey?: string;
  baseUrl?: string;
  models: ModelDescriptor[];
  maxTokens?: number;
}

export type AnthropicProviderErrorCode = "request_failed" | "stream_unavailable" | "invalid_stream";

export class AnthropicProviderError extends Error {
  constructor(readonly code: AnthropicProviderErrorCode) {
    super(`Anthropic provider ${code.replaceAll("_", " ")}`);
    this.name = "AnthropicProviderError";
  }
}

export class AnthropicProvider implements ModelProvider {
  readonly kind = "anthropic";
  readonly id: string;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly models: ModelDescriptor[];
  private readonly maxTokens: number;

  constructor(options: AnthropicProviderOptions) {
    this.id = options.id;
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
    this.models = options.models;
    this.maxTokens = options.maxTokens ?? 1024;
  }

  async listModels(): Promise<ModelDescriptor[]> {
    return this.models;
  }

  async *streamText(request: ModelTextRequest): AsyncIterable<ModelTextChunk> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: this.maxTokens,
        stream: true,
        messages: [{ role: "user", content: request.prompt }],
      }),
      ...(request.signal ? { signal: request.signal } : {}),
    });

    if (!response.ok) throw new AnthropicProviderError("request_failed");
    if (!response.body) throw new AnthropicProviderError("stream_unavailable");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split(/\r?\n/);
        buffer = done ? "" : (lines.pop() ?? "");
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          let frame: { type?: string; delta?: { type?: string; text?: unknown } };
          try {
            frame = JSON.parse(data) as typeof frame;
          } catch {
            throw new AnthropicProviderError("invalid_stream");
          }
          if (frame.type === "message_stop") return;
          if (
            frame.delta?.type === "text_delta" &&
            typeof frame.delta.text === "string" &&
            frame.delta.text.length > 0
          ) {
            yield { text: frame.delta.text };
          }
        }
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }
  }
}
```

- [ ] **Step 5: Export from `packages/providers/src/index.ts`**

Add:

```ts
export * from "./anthropic";
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `CI=true corepack pnpm --filter @future/providers exec vitest run src/anthropic.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Typecheck and commit**

```bash
CI=true corepack pnpm --filter @future/core --filter @future/providers typecheck
git add packages/core/src/providers.ts packages/providers/src/anthropic.ts packages/providers/src/index.ts packages/providers/src/anthropic.test.ts
git commit -m "feat(providers): add native Anthropic streaming provider"
```

---

## Task 3: Native OpenAI provider (thin wrapper)

The existing `OpenAiCompatibleProvider` already speaks OpenAI's `/chat/completions`. A "native OpenAI" provider is that provider pinned to `https://api.openai.com/v1` with a default model list and `kind: "openai"`.

**Files:**

- Create: `packages/providers/src/openai.ts`
- Modify: `packages/providers/src/index.ts`
- Test: `packages/providers/src/openai.test.ts`

- [ ] **Step 1: Write the failing test `packages/providers/src/openai.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { OpenAiProvider } from "./openai";

describe("OpenAiProvider", () => {
  it("targets the OpenAI base URL with a bearer key", async () => {
    const fetchMock = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n'));
          c.close();
        },
      });
      return new Response(body, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiProvider({ id: "openai_1", apiKey: "sk-openai" });
    expect(provider.kind).toBe("openai");
    const out: string[] = [];
    for await (const chunk of provider.streamText({ prompt: "x", model: "gpt-4o" })) out.push(chunk.text);
    expect(out.join("")).toBe("hi");
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.openai.com/v1/chat/completions");
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true corepack pnpm --filter @future/providers exec vitest run src/openai.test.ts`
Expected: FAIL — `Cannot find module './openai'`.

- [ ] **Step 3: Implement `packages/providers/src/openai.ts`**

```ts
import { OpenAiCompatibleProvider } from "./openai-compatible";
import type { ModelDescriptor, ModelProvider, ModelTextChunk, ModelTextRequest } from "./types";

export interface OpenAiProviderOptions {
  id: string;
  apiKey?: string;
  baseUrl?: string;
  models?: ModelDescriptor[];
}

const DEFAULT_MODELS: ModelDescriptor[] = [
  { id: "gpt-4o", displayName: "GPT-4o", contextWindow: 128000 },
  { id: "gpt-4o-mini", displayName: "GPT-4o mini", contextWindow: 128000 },
];

export class OpenAiProvider implements ModelProvider {
  readonly kind = "openai";
  readonly id: string;
  private readonly inner: OpenAiCompatibleProvider;
  private readonly models: ModelDescriptor[];

  constructor(options: OpenAiProviderOptions) {
    this.id = options.id;
    this.models = options.models ?? DEFAULT_MODELS;
    this.inner = new OpenAiCompatibleProvider({
      id: options.id,
      baseUrl: options.baseUrl ?? "https://api.openai.com/v1",
      apiKey: options.apiKey,
      models: this.models,
    });
  }

  async listModels(): Promise<ModelDescriptor[]> {
    return this.models;
  }

  streamText(request: ModelTextRequest): AsyncIterable<ModelTextChunk> {
    return this.inner.streamText(request);
  }
}
```

- [ ] **Step 4: Export from `packages/providers/src/index.ts`**

Add:

```ts
export * from "./openai";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `CI=true corepack pnpm --filter @future/providers exec vitest run src/openai.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

```bash
CI=true corepack pnpm --filter @future/providers typecheck
git add packages/providers/src/openai.ts packages/providers/src/index.ts packages/providers/src/openai.test.ts
git commit -m "feat(providers): add native OpenAI provider wrapper"
```

---

## Task 4: Wire providers + SecretStore into provider-service

**Files:**

- Modify: `apps/api/src/services/provider-service.ts`
- Modify: `apps/api/src/server/dependencies.ts`
- Test: `apps/api/src/services/provider-service.test.ts`

- [ ] **Step 1: Read the current construction paths**

Run: `CI=true corepack pnpm exec grep -n "kind\|OpenAiCompatibleProvider\|OllamaProvider\|register\|secretEnvironmentVariable\|env\[" apps/api/src/services/provider-service.ts`
Note where a `ProviderConfig` is turned into a live `ModelProvider` (the factory switch on `kind`) and where the secret env var is read.

- [ ] **Step 2: Add a failing test `apps/api/src/services/provider-service.test.ts`**

Append a case that builds an Anthropic provider from config using a `SecretStore` stub. Use the existing test's `setup()` helper if present; otherwise:

```ts
import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "@future/providers";
import { buildProvider } from "./provider-service";

describe("buildProvider", () => {
  it("builds a native Anthropic provider and resolves its key from the SecretStore", () => {
    const secrets = {
      get: (n: string) => (n === "FUTURE_ANTHROPIC_API_KEY" ? "sk-ant-x" : undefined),
      set() {},
      list: () => [],
    };
    const provider = buildProvider(
      {
        id: "p1",
        kind: "anthropic",
        displayName: "Claude",
        isLocal: false,
        hasSecret: true,
        capabilities: { streaming: true, text: true, embeddings: false },
        createdAt: "t",
        updatedAt: "t",
      },
      { secretEnvironmentVariable: "FUTURE_ANTHROPIC_API_KEY", model: "claude-sonnet-5" },
      secrets,
    );
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.kind).toBe("anthropic");
  });
});
```

> If `provider-service.ts` has no exported pure `buildProvider(config, extra, secrets)` factory, **extract one** in Step 3 (the current inline switch becomes this function). This keeps the provider-construction logic unit-testable.

- [ ] **Step 3: Run the test to verify it fails**

Run: `CI=true corepack pnpm --filter @future/api exec vitest run src/services/provider-service.test.ts`
Expected: FAIL — `buildProvider` is not exported / Anthropic branch missing.

- [ ] **Step 4: Implement**

In `provider-service.ts`: (a) export a `buildProvider(config, extra, secrets)` function that switches on `config.kind`; add `case "anthropic"` → `new AnthropicProvider({ id, apiKey: secrets.get(extra.secretEnvironmentVariable), models: [...] })` and `case "openai"` → `new OpenAiProvider({ id, apiKey: secrets.get(extra.secretEnvironmentVariable) })`. (b) Replace `process.env[name]` secret reads with `secrets.get(name)`. Keep existing `ollama`/`openai-compatible`/`mock` branches.

In `dependencies.ts`: construct `const secrets = new FileSecretStore(join(dataDir, "secrets.json"))` and pass it wherever `buildProvider`/`getRuntime` is invoked.

Import at top of `provider-service.ts`:

```ts
import { AnthropicProvider, OpenAiProvider } from "@future/providers";
import type { SecretStore } from "@future/core";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `CI=true corepack pnpm --filter @future/api exec vitest run src/services/provider-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Full api check and commit**

```bash
CI=true corepack pnpm --filter @future/api typecheck
git add apps/api/src/services/provider-service.ts apps/api/src/server/dependencies.ts apps/api/src/services/provider-service.test.ts
git commit -m "feat(providers): construct cloud providers from config + SecretStore"
```

---

## Task 5: Redaction types + risk map

**Files:**

- Create: `packages/core/src/redaction.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/permissions/src/risk-map.ts`
- Test: `packages/permissions/src/risk-map.test.ts`

- [ ] **Step 1: Add shared types to `packages/core/src/redaction.ts`**

```ts
export type RedactionRisk = "low" | "high";
export type RedactionDetector = "regex" | "ml";

export interface RedactionEntity {
  type: string;
  start: number;
  end: number;
  risk: RedactionRisk;
  detector: RedactionDetector;
}

export interface RedactionResult {
  redacted: string;
  entities: RedactionEntity[];
  counts: Record<string, number>;
  hasHighRisk: boolean;
  mlAvailable: boolean;
}

export interface RedactionPolicy {
  useMl: boolean;
}
```

- [ ] **Step 2: Export from `packages/core/src/index.ts`**

```ts
export * from "./redaction";
```

- [ ] **Step 3: Write the failing test `packages/permissions/src/risk-map.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { riskFor } from "./risk-map";

describe("riskFor", () => {
  it("classifies financial, government, medical, and credential types as high", () => {
    for (const t of ["credit_card", "ssn", "iban", "secret", "private_key", "medical_record"]) {
      expect(riskFor(t)).toBe("high");
    }
  });
  it("classifies contact/identity types as low", () => {
    for (const t of ["email", "phone", "person", "address", "ip", "url"]) {
      expect(riskFor(t)).toBe("low");
    }
  });
  it("defaults unknown types to low", () => {
    expect(riskFor("mystery")).toBe("low");
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/permissions exec vitest run src/risk-map.test.ts`
Expected: FAIL — `Cannot find module './risk-map'`.

- [ ] **Step 5: Implement `packages/permissions/src/risk-map.ts`**

```ts
import type { RedactionRisk } from "@future/core";

const HIGH_RISK = new Set<string>([
  "credit_card",
  "ssn",
  "iban",
  "bank_account",
  "passport",
  "secret",
  "private_key",
  "credential_path",
  "medical_record",
]);

export function riskFor(type: string): RedactionRisk {
  return HIGH_RISK.has(type) ? "high" : "low";
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/permissions exec vitest run src/risk-map.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck and commit**

```bash
CI=true corepack pnpm --filter @future/core --filter @future/permissions typecheck
git add packages/core/src/redaction.ts packages/core/src/index.ts packages/permissions/src/risk-map.ts packages/permissions/src/risk-map.test.ts
git commit -m "feat(redaction): add shared redaction types and risk map"
```

---

## Task 6: Node regex recognizers

Extends the existing structured-PII patterns with credit card (Luhn-validated), SSN, IBAN, and IP; emits typed placeholders with stable indices and risk tags.

**Files:**

- Create: `packages/permissions/src/recognizers.ts`
- Test: `packages/permissions/src/recognizers.test.ts`

- [ ] **Step 1: Write the failing test `packages/permissions/src/recognizers.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { detectRegexEntities } from "./recognizers";

describe("detectRegexEntities", () => {
  it("detects a Luhn-valid credit card as high-risk", () => {
    const e = detectRegexEntities("card 4242 4242 4242 4242 today");
    const card = e.find((x) => x.type === "credit_card");
    expect(card).toBeDefined();
    expect(card!.risk).toBe("high");
    expect(card!.detector).toBe("regex");
  });

  it("ignores a 16-digit number that fails Luhn", () => {
    const e = detectRegexEntities("num 1234 5678 1234 5678");
    expect(e.find((x) => x.type === "credit_card")).toBeUndefined();
  });

  it("detects email and phone as low-risk and SSN as high-risk", () => {
    const e = detectRegexEntities("me@x.com 415-555-1234 ssn 123-45-6789");
    expect(e.find((x) => x.type === "email")?.risk).toBe("low");
    expect(e.find((x) => x.type === "phone")?.risk).toBe("low");
    expect(e.find((x) => x.type === "ssn")?.risk).toBe("high");
  });

  it("returns entity offsets that map back to the source text", () => {
    const text = "reach me@x.com";
    const [entity] = detectRegexEntities(text);
    expect(text.slice(entity!.start, entity!.end)).toBe("me@x.com");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/permissions exec vitest run src/recognizers.test.ts`
Expected: FAIL — `Cannot find module './recognizers'`.

- [ ] **Step 3: Implement `packages/permissions/src/recognizers.ts`**

```ts
import type { RedactionEntity } from "@future/core";
import { riskFor } from "./risk-map";

interface Recognizer {
  type: string;
  pattern: RegExp;
  validate?(match: string): boolean;
}

function luhnValid(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const RECOGNIZERS: Recognizer[] = [
  {
    type: "private_key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  { type: "secret", pattern: /\bsk-[A-Za-z0-9_-]{10,}\b/g },
  { type: "secret", pattern: /\bBearer\s+[A-Za-z0-9._-]{10,}\b/g },
  { type: "credit_card", pattern: /\b(?:\d[ -]*?){13,19}\b/g, validate: luhnValid },
  { type: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: "iban", pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
  { type: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { type: "phone", pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { type: "ip", pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
];

export function detectRegexEntities(text: string): RedactionEntity[] {
  const entities: RedactionEntity[] = [];
  for (const rec of RECOGNIZERS) {
    rec.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rec.pattern.exec(text)) !== null) {
      if (match[0].length === 0) {
        rec.pattern.lastIndex += 1;
        continue;
      }
      if (rec.validate && !rec.validate(match[0])) continue;
      entities.push({
        type: rec.type,
        start: match.index,
        end: match.index + match[0].length,
        risk: riskFor(rec.type),
        detector: "regex",
      });
    }
  }
  return entities.sort((a, b) => a.start - b.start);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/permissions exec vitest run src/recognizers.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/permissions/src/recognizers.ts packages/permissions/src/recognizers.test.ts
git commit -m "feat(redaction): add Luhn-validated regex recognizers"
```

---

## Task 7: RedactionEngine interface + Node engine (ML slot ready)

**Files:**

- Create: `packages/permissions/src/redaction-engine.ts`
- Create: `packages/permissions/src/redaction-node.ts`
- Modify: `packages/permissions/src/index.ts`
- Test: `packages/permissions/src/redaction-node.test.ts`

- [ ] **Step 1: Define the interface `packages/permissions/src/redaction-engine.ts`**

```ts
import type { RedactionEntity, RedactionPolicy, RedactionResult } from "@future/core";

export interface MlRecognizer {
  available: boolean;
  detect(text: string): Promise<RedactionEntity[]>;
}

export interface RedactionEngine {
  analyze(text: string, policy?: RedactionPolicy): Promise<RedactionEntity[]>;
  redact(text: string, policy?: RedactionPolicy): Promise<RedactionResult>;
}
```

- [ ] **Step 2: Write the failing test `packages/permissions/src/redaction-node.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { NodeRedactionEngine } from "./redaction-node";

describe("NodeRedactionEngine", () => {
  it("masks entities with stable typed placeholders and reports counts", async () => {
    const engine = new NodeRedactionEngine();
    const result = await engine.redact("email me@x.com or me@x.com");
    expect(result.redacted).toBe("email [EMAIL_1] or [EMAIL_2]");
    expect(result.counts.email).toBe(2);
    expect(result.hasHighRisk).toBe(false);
    expect(result.mlAvailable).toBe(false);
  });

  it("flags high-risk when a credit card is present", async () => {
    const engine = new NodeRedactionEngine();
    const result = await engine.redact("pay 4242 4242 4242 4242");
    expect(result.hasHighRisk).toBe(true);
    expect(result.redacted).toContain("[CREDIT_CARD_1]");
  });

  it("is deterministic for identical input", async () => {
    const engine = new NodeRedactionEngine();
    const a = await engine.redact("me@x.com");
    const b = await engine.redact("me@x.com");
    expect(a.redacted).toBe(b.redacted);
  });

  it("uses an injected ML recognizer when policy.useMl is true", async () => {
    const engine = new NodeRedactionEngine({
      available: true,
      detect: async () => [{ type: "person", start: 0, end: 3, risk: "low", detector: "ml" }],
    });
    const result = await engine.redact("Ada lives here", { useMl: true });
    expect(result.mlAvailable).toBe(true);
    expect(result.counts.person).toBe(1);
    expect(result.redacted.startsWith("[PERSON_1]")).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/permissions exec vitest run src/redaction-node.test.ts`
Expected: FAIL — `Cannot find module './redaction-node'`.

- [ ] **Step 4: Implement `packages/permissions/src/redaction-node.ts`**

```ts
import type { RedactionEntity, RedactionPolicy, RedactionResult } from "@future/core";
import type { MlRecognizer, RedactionEngine } from "./redaction-engine";
import { detectRegexEntities } from "./recognizers";

const NO_ML: MlRecognizer = { available: false, detect: async () => [] };

export class NodeRedactionEngine implements RedactionEngine {
  constructor(private readonly ml: MlRecognizer = NO_ML) {}

  async analyze(text: string, policy: RedactionPolicy = { useMl: false }): Promise<RedactionEntity[]> {
    const regex = detectRegexEntities(text);
    const ml = policy.useMl && this.ml.available ? await this.ml.detect(text) : [];
    return dedupe([...regex, ...ml]);
  }

  async redact(text: string, policy: RedactionPolicy = { useMl: false }): Promise<RedactionResult> {
    const entities = await this.analyze(text, policy);
    const counts: Record<string, number> = {};
    let redacted = "";
    let cursor = 0;
    for (const entity of entities) {
      if (entity.start < cursor) continue; // skip overlaps
      counts[entity.type] = (counts[entity.type] ?? 0) + 1;
      const label = `[${entity.type.toUpperCase()}_${counts[entity.type]}]`;
      redacted += text.slice(cursor, entity.start) + label;
      cursor = entity.end;
    }
    redacted += text.slice(cursor);
    return {
      redacted,
      entities,
      counts,
      hasHighRisk: entities.some((e) => e.risk === "high"),
      mlAvailable: this.ml.available,
    };
  }
}

function dedupe(entities: RedactionEntity[]): RedactionEntity[] {
  return entities
    .slice()
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((entity, index, all) => index === 0 || entity.start >= all[index - 1]!.end);
}
```

- [ ] **Step 5: Export from `packages/permissions/src/index.ts`**

```ts
export * from "./redaction-engine";
export * from "./redaction-node";
export * from "./recognizers";
export * from "./risk-map";
```

- [ ] **Step 6: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/permissions exec vitest run src/redaction-node.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Typecheck and commit**

```bash
CI=true corepack pnpm --filter @future/permissions typecheck
git add packages/permissions/src/redaction-engine.ts packages/permissions/src/redaction-node.ts packages/permissions/src/index.ts packages/permissions/src/redaction-node.test.ts
git commit -m "feat(redaction): add pluggable RedactionEngine with Node default"
```

> **Optional follow-up task (not required for mode C to ship):** implement `GlinerMlRecognizer` in `packages/permissions/src/redaction-gliner.ts` using `onnxruntime-node` + a bundled/first-run-fetched GLiNER-PII ONNX model, satisfying the `MlRecognizer` interface. Ship `NO_ML` as the default until then; acceptance for Unit B explicitly allows regex-only with `mlAvailable: false`.

---

## Task 8: Mode-C integration into the turn lifecycle

Replace the `if (!isLocal)` force-approval branch so that: every outbound turn is redacted; cloud low-risk sends automatically; cloud high-risk pauses in the existing `awaiting_approval` preview; local sends unredacted unless `redactLocalToo` is set.

**Files:**

- Modify: `apps/api/src/services/assistant-service.ts` (branch at line ~82; local send at line ~184)
- Modify: `apps/api/src/server/dependencies.ts` (inject a `RedactionEngine` + settings reader)
- Test: `apps/api/src/services/assistant-service.test.ts`

- [ ] **Step 1: Read the current turn flow once more**

Run: `CI=true corepack pnpm exec grep -n "isLocal\|buildPrompt\|awaiting_approval\|redactedPrompt\|streamText" apps/api/src/services/assistant-service.ts`
Confirm: cloud path (lines ~82–134) creates a preview and returns; local path (lines ~135–194) streams `buildPrompt(...)`.

- [ ] **Step 2: Add a failing integration test to `apps/api/src/services/assistant-service.test.ts`**

Use the file's existing `setup()`/turn helpers. Add three cases (mirror existing streaming-test structure):

```ts
// (1) cloud + low-risk PII -> auto-masked, streams, no awaiting_approval
//     prompt contains "email me@x.com"; assert streamed frames reach a terminal
//     "completed" (no "approval_required"), and the model received "[EMAIL_1]".
// (2) cloud + high-risk PII -> pauses; assert an "approval_required" frame and
//     turn state "awaiting_approval" when prompt contains "4242 4242 4242 4242".
// (3) local provider + redactLocalToo=false -> model receives the raw prompt.
```

Concretely, assert the prompt the provider saw by using a capturing mock provider (the test suite already stubs providers via `getRuntime`); check `capturedPrompt` includes `[EMAIL_1]` in case (1) and the raw email in case (3).

- [ ] **Step 3: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/api exec vitest run src/services/assistant-service.test.ts`
Expected: FAIL — low-risk cloud turn currently returns `approval_required` instead of streaming.

- [ ] **Step 4: Implement the mode-C branch**

In `dependencies.ts`, add `const redaction = new NodeRedactionEngine();` and a settings reader `getSettings(workspaceId): { redactLocalToo: boolean }` (default `false`); pass both into the assistant-service deps.

In `assistant-service.ts`, replace the `if (!isLocal) { ...force preview... }` block and the local `buildPrompt` send with unified logic:

```ts
const rawPrompt = buildPrompt(message, contextPack.items);
const { redactLocalToo } = this.dependencies.getSettings(building.workspaceId);
const shouldRedact = !isLocal || redactLocalToo;
const redaction = shouldRedact
  ? await this.dependencies.redaction.redact(rawPrompt, { useMl: false })
  : { redacted: rawPrompt, entities: [], counts: {}, hasHighRisk: false, mlAvailable: false };

// Cloud + high-risk -> pause using the existing preview flow (unchanged below),
// but seed the preview's redactedPrompt/redactionCounts from `redaction`.
if (!isLocal && redaction.hasHighRisk) {
  // ...existing createForTurn + awaiting_approval path, passing redaction.redacted...
  return;
}

// Otherwise (local, or cloud low-risk): stream directly with the possibly-masked prompt.
const outboundPrompt = redaction.redacted;
// ...existing beginModelCall + provider.streamText({ prompt: outboundPrompt, ... }) ...
```

Record `redaction.counts` on the `context_pack.created`/model-call events (never the raw prompt). Keep the approved-path (line ~410) using `preview.redactedPrompt` as-is.

- [ ] **Step 5: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/api exec vitest run src/services/assistant-service.test.ts`
Expected: PASS (existing + 3 new cases).

- [ ] **Step 6: Guard against secret leakage**

Confirm no test asserts a raw pre-redaction prompt in any timeline payload. Run the full api suite:
Run: `CI=true corepack pnpm --filter @future/api test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/assistant-service.ts apps/api/src/server/dependencies.ts apps/api/src/services/assistant-service.test.ts
git commit -m "feat(assistant): always-on redaction with mode-C cloud gating"
```

---

## Final verification (Plan 1)

- [ ] Run the full gate:

```bash
CI=true corepack pnpm check
```

Expected: typecheck, lint, format, and all unit tests pass.

- [ ] Confirm Spec §4 Units A/B/C acceptance criteria are met: cloud low-risk auto-masks and streams; cloud high-risk pauses and is approvable/deniable; local unredacted by default; secrets never persisted; engine is swappable behind `RedactionEngine`.

## Spec-coverage note

- Unit A ✅ Tasks 1–4. Unit B ✅ Tasks 5–7 (ML recognizer is an allowed optional follow-up). Unit C ✅ Task 8.
- Deferred within this plan: real GLiNER ONNX wiring (interface + graceful `mlAvailable:false` default shipped); UI for entering keys/toggles lands in Plan 3 (Settings drawer), which consumes `SecretStore` and the settings reader created here.
