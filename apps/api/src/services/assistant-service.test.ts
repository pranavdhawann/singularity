import type { ModelProfile, ModelProvider } from "@future/core";
import {
  AssistantTurnRepository,
  CompactionRepository,
  ContextPackRepository,
  EmbeddingRepository,
  EventRepository,
  MemoryRepository,
  NamespaceRepository,
  PromptPreviewRepository,
  createTestDb,
  type TestDb,
} from "@future/db";
import { NodeRedactionEngine, type RedactionEngine } from "@future/permissions";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AssistantService } from "./assistant-service";
import { ContextService } from "./context-service";
import { MemoryService } from "./memory-service";
import { TurnCancellationRegistry } from "./turn-cancellation";
import { PromptPreviewService } from "./prompt-preview-service";

const profile: ModelProfile = {
  id: "profile_1",
  providerId: "provider_1",
  name: "Test model",
  model: "test-model",
  contextWindow: 4096,
  purpose: "general",
  privacyPolicy: "local_only",
  createdAt: "2026-07-10T12:00:00.000Z",
  updatedAt: "2026-07-10T12:00:00.000Z",
};

describe("AssistantService", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("creates idempotently and completes a persisted cited stream", async () => {
    seedApprovedMemory(db);
    const provider = providerFrom(async function* () {
      yield { text: "Hello " };
      yield { text: "world" };
    });
    const service = createService(db, provider);
    const input = {
      workspaceId: "w_demo",
      modelProfileId: profile.id,
      idempotencyKey: "key_1",
      message: "What is the SQLite decision?",
    };

    const created = service.createTurn(input);
    expect(service.createTurn(input)).toEqual({ turn: created.turn, replayed: true });
    const frames = await collect(service.streamTurn(created.turn.id));

    expect(frames.map((frame) => frame.type)).toEqual(["started", "context", "delta", "delta", "completed"]);
    const completed = frames.at(-1);
    expect(completed).toEqual(expect.objectContaining({ type: "completed", citations: expect.any(Array) }));
    expect(service.getTurn(created.turn.id)).toEqual(
      expect.objectContaining({
        state: "completed",
        contextPackId: expect.any(String),
        assistantEventId: expect.any(String),
      }),
    );
    expect(db.client.prepare("SELECT status FROM model_calls").pluck().get()).toBe("completed");
    expect(db.client.prepare("SELECT COUNT(*) FROM events WHERE type = 'user.message.created'").pluck().get()).toBe(1);
    expect(db.client.prepare("SELECT COUNT(*) FROM assistant_response_sources").pluck().get()).toBeGreaterThan(0);
    await expect(collect(service.streamTurn(created.turn.id))).rejects.toThrow(/not streamable/);
  });

  it("persists safe failure events without a completed response", async () => {
    const provider = providerFrom(async function* () {
      throw new Error("secret provider detail");
    });
    const service = createService(db, provider);
    const { turn } = service.createTurn({
      workspaceId: "w_demo",
      modelProfileId: profile.id,
      idempotencyKey: "key_fail",
      message: "Fail safely",
    });

    const frames = await collect(service.streamTurn(turn.id));

    expect(frames.at(-1)).toEqual(
      expect.objectContaining({ type: "failed", message: "The model provider could not complete this turn." }),
    );
    expect(service.getTurn(turn.id)).toEqual(expect.objectContaining({ state: "failed", errorCode: "provider_error" }));
    expect(db.client.prepare("SELECT status FROM model_calls").pluck().get()).toBe("failed");
    expect(db.client.prepare("SELECT COUNT(*) FROM events WHERE type = 'model_call.failed'").pluck().get()).toBe(1);
    expect(db.client.prepare("SELECT COUNT(*) FROM events WHERE type = 'assistant.turn.failed'").pluck().get()).toBe(1);
    expect(
      db.client.prepare("SELECT COUNT(*) FROM events WHERE type = 'assistant.response.created'").pluck().get(),
    ).toBe(0);
  });

  it("persists cancellation and partial-output metadata", async () => {
    const provider = providerFrom(async function* (request) {
      yield { text: "partial" };
      request.signal?.throwIfAborted();
      yield { text: " response" };
    });
    const service = createService(db, provider);
    const { turn } = service.createTurn({
      workspaceId: "w_demo",
      modelProfileId: profile.id,
      idempotencyKey: "key_cancel",
      message: "Cancel this",
    });
    const stream = service.streamTurn(turn.id)[Symbol.asyncIterator]();

    expect((await stream.next()).value?.type).toBe("started");
    expect((await stream.next()).value?.type).toBe("context");
    expect(await stream.next()).toEqual({ done: false, value: { type: "delta", text: "partial" } });
    service.cancelTurn(turn.id);
    expect((await stream.next()).value?.type).toBe("cancelled");

    expect(service.getTurn(turn.id)).toEqual(expect.objectContaining({ state: "cancelled" }));
    expect(db.client.prepare("SELECT status FROM model_calls").pluck().get()).toBe("cancelled");
    const cancelled = db.client
      .prepare("SELECT payload_json FROM events WHERE type = 'model_call.cancelled'")
      .pluck()
      .get() as string;
    expect(JSON.parse(cancelled)).toEqual(expect.objectContaining({ partialCharacters: 7 }));
    expect(
      db.client.prepare("SELECT COUNT(*) FROM events WHERE type = 'assistant.response.created'").pluck().get(),
    ).toBe(0);
  });

  it("pauses an external turn with high-risk PII for exact approval and resumes it once", async () => {
    let providerCalls = 0;
    const provider = {
      ...providerFrom(async function* () {
        providerCalls += 1;
        yield { text: "Approved answer" };
      }),
      kind: "openai-compatible" as const,
    };
    const previews = new PromptPreviewRepository(db.client);
    const promptPreviewService = new PromptPreviewService({ previews });
    const service = createService(db, provider, { isLocal: false, promptPreviewService });
    const { turn } = service.createTurn({
      workspaceId: "w_demo",
      modelProfileId: profile.id,
      idempotencyKey: "key_external",
      message: "Card 4242 4242 4242 4242, email user@example.com",
    });

    const waitingFrames = await collect(service.streamTurn(turn.id));
    const approvalFrame = waitingFrames.at(-1);
    expect(waitingFrames.map((frame) => frame.type)).toEqual(["started", "context", "approval_required"]);
    expect(providerCalls).toBe(0);
    expect(service.getTurn(turn.id)?.state).toBe("awaiting_approval");
    if (approvalFrame?.type !== "approval_required") throw new Error("approval frame missing");
    const preview = previews.get(approvalFrame.previewId)!;
    expect(preview.redactedPrompt).not.toContain("user@example.com");

    promptPreviewService.decide(preview.id, "approved", preview.bindingHash);
    const completedFrames = await collect(service.streamTurn(turn.id));

    expect(completedFrames.map((frame) => frame.type)).toEqual(["started", "context", "delta", "completed"]);
    expect(providerCalls).toBe(1);
    expect(service.getTurn(turn.id)?.state).toBe("completed");
    expect(db.client.prepare("SELECT prompt_preview_id FROM model_calls").pluck().get()).toBe(preview.id);
    expect(db.client.prepare("SELECT prompt_decision_id FROM model_calls").pluck().get()).toEqual(expect.any(String));
    const timelinePayloads = db.client
      .prepare("SELECT payload_json FROM events WHERE type <> 'user.message.created'")
      .pluck()
      .all() as string[];
    expect(timelinePayloads.join("\n")).not.toContain("user@example.com");
  });

  it("terminates denied and cancelled approval waits without a model call", async () => {
    const provider = {
      ...providerFrom(async function* () {
        yield { text: "never" };
      }),
      kind: "openai-compatible" as const,
    };
    const previews = new PromptPreviewRepository(db.client);
    const promptPreviewService = new PromptPreviewService({ previews });
    const service = createService(db, provider, { isLocal: false, promptPreviewService });

    const deniedTurn = service.createTurn({
      workspaceId: "w_demo",
      modelProfileId: profile.id,
      idempotencyKey: "key_denied",
      message: "Do not send card 4242 4242 4242 4242",
    }).turn;
    const deniedFrames = await collect(service.streamTurn(deniedTurn.id));
    const deniedApproval = deniedFrames.at(-1);
    if (deniedApproval?.type !== "approval_required") throw new Error("approval frame missing");
    const deniedPreview = previews.get(deniedApproval.previewId)!;
    promptPreviewService.decide(deniedPreview.id, "denied", deniedPreview.bindingHash);
    const denied = service.denyTurnForPreview(deniedPreview.id);

    expect(denied).toMatchObject({ state: "failed", errorCode: "grant_denied" });
    expect(db.client.prepare("SELECT COUNT(*) FROM model_calls").pluck().get()).toBe(0);
    expect(db.client.prepare("SELECT COUNT(*) FROM events WHERE type = 'prompt_preview.denied'").pluck().get()).toBe(1);

    const cancelledTurn = service.createTurn({
      workspaceId: "w_demo",
      modelProfileId: profile.id,
      idempotencyKey: "key_cancel_wait",
      message: "Cancel approval card 4242 4242 4242 4242",
    }).turn;
    const cancelledFrames = await collect(service.streamTurn(cancelledTurn.id));
    const cancelledApproval = cancelledFrames.at(-1);
    if (cancelledApproval?.type !== "approval_required") throw new Error("approval frame missing");
    const cancelled = service.cancelTurn(cancelledTurn.id);

    expect(cancelled.state).toBe("cancelled");
    expect(previews.isInvalidated(cancelledApproval.previewId)).toBe(true);
  });

  it("mode C: auto-masks low-risk PII on a cloud turn and streams straight to completion", async () => {
    const { provider, prompts } = capturingProvider("Got it");
    const cloudProvider = { ...provider, kind: "openai-compatible" as const };
    const service = createService(db, cloudProvider, { isLocal: false });
    const { turn } = service.createTurn({
      workspaceId: "w_demo",
      modelProfileId: profile.id,
      idempotencyKey: "key_low_risk_cloud",
      message: "Email me at me@x.com",
    });

    const frames = await collect(service.streamTurn(turn.id));

    expect(frames.map((frame) => frame.type)).toEqual(["started", "context", "delta", "completed"]);
    expect(service.getTurn(turn.id)?.state).toBe("completed");
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("[EMAIL_1]");
    expect(prompts[0]).not.toContain("me@x.com");
  });

  it("mode C: pauses a cloud turn when the prompt contains high-risk PII (credit card)", async () => {
    const { provider, prompts } = capturingProvider("never");
    const cloudProvider = { ...provider, kind: "openai-compatible" as const };
    const service = createService(db, cloudProvider, { isLocal: false });
    const { turn } = service.createTurn({
      workspaceId: "w_demo",
      modelProfileId: profile.id,
      idempotencyKey: "key_high_risk_cloud",
      message: "Card 4242 4242 4242 4242",
    });

    const frames = await collect(service.streamTurn(turn.id));

    expect(frames.map((frame) => frame.type)).toEqual(["started", "context", "approval_required"]);
    expect(service.getTurn(turn.id)?.state).toBe("awaiting_approval");
    expect(prompts).toHaveLength(0);
  });

  it("mode C: a local provider with redactLocalToo=false sends the raw prompt", async () => {
    const { provider, prompts } = capturingProvider("Local ok");
    const service = createService(db, provider, { isLocal: true, redactLocalToo: false });
    const { turn } = service.createTurn({
      workspaceId: "w_demo",
      modelProfileId: profile.id,
      idempotencyKey: "key_local_raw",
      message: "Email me at me@x.com",
    });

    const frames = await collect(service.streamTurn(turn.id));

    expect(frames.map((frame) => frame.type)).toEqual(["started", "context", "delta", "completed"]);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("me@x.com");
  });

  it("auto-capture: stores a salient fact from the user message as an approved memory once the turn completes", async () => {
    const provider = providerFrom(async function* () {
      yield { text: "Noted." };
    });
    const { service, memories } = createServiceWithMemories(db, provider);
    const { turn } = service.createTurn({
      workspaceId: "w_demo",
      modelProfileId: profile.id,
      idempotencyKey: "key_auto_capture",
      message: "My dog's name is Ada.",
    });

    const frames = await collect(service.streamTurn(turn.id));

    expect(frames.at(-1)).toEqual(expect.objectContaining({ type: "completed" }));
    const statements = memories.list({ workspaceId: "w_demo" }).items.map((memory) => memory.statement);
    expect(statements).toContain("My dog's name is Ada.");
    const captured = memories.list({ workspaceId: "w_demo" }).items.find((memory) => memory.statement === "My dog's name is Ada.");
    expect(captured?.reviewState).toBe("approved");
  });

  it("auto-capture: creates no memory when the workspace has autoCapture disabled", async () => {
    const provider = providerFrom(async function* () {
      yield { text: "Noted." };
    });
    const { service, memories } = createServiceWithMemories(db, provider, { autoCapture: false });
    const { turn } = service.createTurn({
      workspaceId: "w_demo",
      modelProfileId: profile.id,
      idempotencyKey: "key_auto_capture_off",
      message: "My dog's name is Ada.",
    });

    const frames = await collect(service.streamTurn(turn.id));

    expect(frames.at(-1)).toEqual(expect.objectContaining({ type: "completed" }));
    const statements = memories.list({ workspaceId: "w_demo" }).items.map((memory) => memory.statement);
    expect(statements).not.toContain("My dog's name is Ada.");
  });
});

function createService(
  db: TestDb,
  provider: ModelProvider,
  options: {
    isLocal?: boolean;
    promptPreviewService?: PromptPreviewService;
    redaction?: RedactionEngine;
    redactLocalToo?: boolean;
    autoCapture?: boolean;
    memoryService?: MemoryService;
    memories?: MemoryRepository;
  } = {},
): AssistantService {
  const events = new EventRepository(db.client);
  const contextPacks = new ContextPackRepository(db.client);
  const memories = options.memories ?? new MemoryRepository(db.client);
  const memoryService =
    options.memoryService ??
    new MemoryService({
      db: db.client,
      memories,
      namespaces: new NamespaceRepository(db.client),
      compactions: new CompactionRepository(db.client),
      embeddings: new EmbeddingRepository(db.client),
      events,
    });
  return new AssistantService({
    db: db.client,
    turns: new AssistantTurnRepository(db.client),
    events,
    contextService: new ContextService({ db: db.client, events, contextPacks }),
    providerService: { getRuntime: () => ({ provider, profile, isLocal: options.isLocal ?? true }) },
    promptPreviewService:
      options.promptPreviewService ??
      new PromptPreviewService({
        previews: new PromptPreviewRepository(db.client),
      }),
    cancellations: new TurnCancellationRegistry(),
    redaction: options.redaction ?? new NodeRedactionEngine(),
    getSettings: () => ({
      redactLocalToo: options.redactLocalToo ?? false,
      autoCapture: options.autoCapture ?? true,
    }),
    memoryService,
    memories,
  });
}

function createServiceWithMemories(
  db: TestDb,
  provider: ModelProvider,
  options: { autoCapture?: boolean } = {},
): { service: AssistantService; memories: MemoryRepository } {
  const memories = new MemoryRepository(db.client);
  const service = createService(db, provider, { ...options, memories });
  return { service, memories };
}

function providerFrom(streamText: ModelProvider["streamText"]): ModelProvider {
  return {
    id: "provider_1",
    kind: "mock",
    async listModels() {
      return [];
    },
    streamText,
  };
}

function capturingProvider(text: string): { provider: ModelProvider; prompts: string[] } {
  const prompts: string[] = [];
  const provider = providerFrom(async function* (request) {
    prompts.push(request.prompt);
    yield { text };
  });
  return { provider, prompts };
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

function seedApprovedMemory(db: TestDb): void {
  const now = "2026-07-10T12:00:00.000Z";
  db.client
    .prepare(
      `INSERT INTO memories (
      id, workspace_id, type, statement, summary, confidence, scope_json,
      privacy_json, review_state, pinned, outdated_at, last_confirmed_at,
      created_at, updated_at
    ) VALUES (
      'mem_1', 'w_demo', 'decision', 'Use SQLite for local storage.', NULL,
      0.95, '{}', '{"labels":["local"]}', 'approved', 1, NULL, NULL, @now, @now
    )`,
    )
    .run({ now });
}
