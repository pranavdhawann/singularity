import type { AssistantStreamFrame, AssistantTurnDto } from "@future/core";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FutureApi } from "../../app/api-types";
import { useAssistantTurn } from "./use-assistant-turn";

const turn: AssistantTurnDto = {
  id: "turn_1",
  workspaceId: "w_1",
  modelProfileId: "profile_1",
  idempotencyKey: "key_1",
  state: "queued",
  userEventId: "evt_user",
  createdAt: "2026-07-10T12:00:00.000Z",
  updatedAt: "2026-07-10T12:00:00.000Z",
};

describe("useAssistantTurn", () => {
  it("concatenates streamed deltas and refreshes timeline/context on completion", async () => {
    const completed = { ...turn, state: "completed" as const, contextPackId: "ctx_1", assistantEventId: "evt_answer" };
    const streamAssistantTurn = vi.fn(async function* (): AsyncIterable<AssistantStreamFrame> {
      yield { type: "started", turn };
      yield { type: "context", contextPackId: "ctx_1", sourceCount: 1 };
      yield { type: "delta", text: "Hello " };
      yield { type: "delta", text: "world" };
      yield {
        type: "completed",
        turn: completed,
        event: {
          id: "evt_answer",
          workspaceId: "w_1",
          type: "assistant.response.created",
          actor: "assistant",
          title: "Answer",
          payload: {},
          privacy: {},
          createdAt: "2026-07-10T12:01:00.000Z",
        },
        citations: [],
      };
    });
    const api = {
      createAssistantTurn: vi.fn(async () => ({ turn, replayed: false })),
      streamAssistantTurn,
      cancelAssistantTurn: vi.fn(),
    } as unknown as FutureApi;
    const onTimelineChanged = vi.fn();
    const onContextSelected = vi.fn();
    const { result } = renderHook(() => useAssistantTurn({ api, onTimelineChanged, onContextSelected }));

    await act(async () => {
      await result.current.submit({ workspaceId: "w_1", modelProfileId: "profile_1", message: "Hello" });
    });

    expect(result.current.status).toBe("completed");
    expect(result.current.streamedText).toBe("Hello world");
    expect(onTimelineChanged).toHaveBeenCalled();
    expect(onContextSelected).toHaveBeenCalledWith("ctx_1");
  });

  it("loads an exact external preview and resumes the same turn after approval", async () => {
    const preview = {
      id: "preview_1",
      workspaceId: "w_1",
      turnId: turn.id,
      providerId: "provider_1",
      modelProfileId: "profile_1",
      model: "model-1",
      endpointClassification: "external" as const,
      contextPackId: "ctx_1",
      contextPackHash: "ctx-hash",
      redactedPrompt: "Email [REDACTED_EMAIL]",
      promptHash: "prompt-hash",
      bindingHash: "binding-hash",
      estimatedTokens: 8,
      privacyLabels: ["private"],
      redactionCounts: { email: 1 },
      selectedSources: [],
      excludedSources: [],
      createdAt: "2026-07-11T00:00:00.000Z",
      expiresAt: "2026-07-11T00:05:00.000Z",
    };
    const completed = { ...turn, state: "completed" as const, contextPackId: "ctx_1", assistantEventId: "evt_answer" };
    const streamAssistantTurn = vi
      .fn()
      .mockImplementationOnce(async function* (): AsyncIterable<AssistantStreamFrame> {
        yield { type: "started", turn };
        yield { type: "context", contextPackId: "ctx_1", sourceCount: 0 };
        yield { type: "approval_required", turnId: turn.id, previewId: preview.id };
      })
      .mockImplementationOnce(async function* (): AsyncIterable<AssistantStreamFrame> {
        yield { type: "started", turn: { ...turn, state: "awaiting_approval" } };
        yield { type: "delta", text: "Approved" };
        yield {
          type: "completed",
          turn: completed,
          event: {
            id: "evt_answer",
            workspaceId: "w_1",
            type: "assistant.response.created",
            actor: "assistant",
            title: "Answer",
            payload: {},
            privacy: {},
            createdAt: "2026-07-11T00:01:00.000Z",
          },
          citations: [],
        };
      });
    const api = {
      createAssistantTurn: vi.fn(async () => ({ turn, replayed: false })),
      streamAssistantTurn,
      getPromptPreview: vi.fn(async () => preview),
      decidePromptPreview: vi.fn(async () => ({
        id: "decision_1",
        previewId: preview.id,
        decision: "approved" as const,
        bindingHash: preview.bindingHash,
        decidedAt: "2026-07-11T00:00:30.000Z",
      })),
      cancelAssistantTurn: vi.fn(),
    } as unknown as FutureApi;
    const { result } = renderHook(() =>
      useAssistantTurn({
        api,
        onTimelineChanged: vi.fn(),
        onContextSelected: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.submit({ workspaceId: "w_1", modelProfileId: "profile_1", message: "Hello" });
    });
    expect(result.current.status).toBe("awaiting_approval");
    expect(result.current.promptPreview).toEqual(preview);

    await act(async () => {
      await result.current.approvePrompt();
    });

    expect(api.decidePromptPreview).toHaveBeenCalledWith(preview.id, "w_1", "approved", preview.bindingHash);
    expect(streamAssistantTurn).toHaveBeenNthCalledWith(2, turn.id);
    expect(result.current.status).toBe("completed");
    expect(result.current.streamedText).toBe("Approved");
  });
});
