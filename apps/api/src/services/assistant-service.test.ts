import type { ModelProfile, ModelProvider } from "@future/core";
import {
  AssistantTurnRepository,
  ContextPackRepository,
  EventRepository,
  PromptPreviewRepository,
  createTestDb,
  type TestDb,
} from "@future/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AssistantService } from "./assistant-service";
import { ContextService } from "./context-service";
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

  it("pauses an external turn for exact approval and resumes it once", async () => {
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
      message: "Email user@example.com",
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
      message: "Do not send",
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
      message: "Cancel approval",
    }).turn;
    const cancelledFrames = await collect(service.streamTurn(cancelledTurn.id));
    const cancelledApproval = cancelledFrames.at(-1);
    if (cancelledApproval?.type !== "approval_required") throw new Error("approval frame missing");
    const cancelled = service.cancelTurn(cancelledTurn.id);

    expect(cancelled.state).toBe("cancelled");
    expect(previews.isInvalidated(cancelledApproval.previewId)).toBe(true);
  });
});

function createService(
  db: TestDb,
  provider: ModelProvider,
  options: { isLocal?: boolean; promptPreviewService?: PromptPreviewService } = {},
): AssistantService {
  const events = new EventRepository(db.client);
  const contextPacks = new ContextPackRepository(db.client);
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
  });
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
