import { createHash } from "node:crypto";
import {
  createEvent,
  createId,
  serializeTimelineEvent,
  type AssistantStreamFrame,
  type AssistantTurnDto,
  type CreateAssistantTurnInput,
  type ModelProfile,
  type ModelProvider,
} from "@future/core";
import type { AssistantTurnRepository, EventRepository, SqliteDatabase } from "@future/db";
import type { ContextService } from "./context-service";
import type { TurnCancellationRegistry } from "./turn-cancellation";
import { PromptPreviewServiceError, type PromptPreviewService } from "./prompt-preview-service";

interface ProviderRuntimeResolver {
  getRuntime(profileId: string): { provider: ModelProvider; profile: ModelProfile; isLocal: boolean };
}

interface AssistantServiceDependencies {
  db: SqliteDatabase;
  turns: AssistantTurnRepository;
  events: EventRepository;
  contextService: ContextService;
  providerService: ProviderRuntimeResolver;
  cancellations: TurnCancellationRegistry;
  promptPreviewService: PromptPreviewService;
}

interface UserEventRow {
  payload_json: string;
}

export type AssistantServiceErrorCode = "turn_not_found" | "turn_not_streamable" | "turn_terminal" | "turn_not_active";

export class AssistantServiceError extends Error {
  constructor(readonly code: AssistantServiceErrorCode) {
    super(code.replaceAll("_", " "));
    this.name = "AssistantServiceError";
  }
}

export class AssistantService {
  constructor(private readonly dependencies: AssistantServiceDependencies) {}

  createTurn(input: CreateAssistantTurnInput): { turn: AssistantTurnDto; replayed: boolean } {
    return this.dependencies.turns.create(input);
  }

  getTurn(turnId: string): AssistantTurnDto | undefined {
    return this.dependencies.turns.get(turnId);
  }

  async *streamTurn(turnId: string): AsyncIterable<AssistantStreamFrame> {
    const initial = this.dependencies.turns.get(turnId);
    if (!initial) throw new AssistantServiceError("turn_not_found");
    if (initial.state === "awaiting_approval") {
      yield* this.resumeApprovedTurn(initial);
      return;
    }
    if (initial.state !== "queued") throw new AssistantServiceError("turn_not_streamable");

    const signal = this.dependencies.cancellations.start(turnId);
    let partialText = "";
    let modelCallId: string | undefined;

    try {
      yield { type: "started", turn: initial };
      const building = this.dependencies.turns.updateState(turnId, "building_context");
      const message = this.getUserMessage(building.userEventId);
      const { provider, profile, isLocal } = this.dependencies.providerService.getRuntime(building.modelProfileId);
      const contextPack = await this.dependencies.contextService.buildForTurn({
        turnId,
        workspaceId: building.workspaceId,
        userEventId: building.userEventId,
        query: message,
        providerId: profile.providerId,
        profile,
      });

      if (!isLocal) {
        const preview = this.dependencies.promptPreviewService.createForTurn({
          workspaceId: building.workspaceId,
          turnId,
          providerId: profile.providerId,
          modelProfileId: profile.id,
          model: profile.model,
          contextPackId: contextPack.id,
          contextPackHash: hashValue(JSON.stringify(contextPack.items)),
          instructions: "Answer the user using the selected context and cite sources when used.",
          userText: message,
          segments: contextPack.items.map((item) => ({
            source: item.source,
            text: item.text,
            privacyLabels: ["private"],
          })),
        });
        const waitForApproval = this.dependencies.db.transaction(() => {
          this.dependencies.events.appendInCurrentTransaction(
            createEvent({
              workspaceId: building.workspaceId,
              type: "context_pack.created",
              actor: "system",
              title: "Built local context",
              payload: { turnId, contextPackId: contextPack.id, sourceCount: contextPack.items.length },
              privacy: { labels: ["local"] },
            }),
          );
          this.dependencies.events.appendInCurrentTransaction(
            createEvent({
              workspaceId: building.workspaceId,
              type: "prompt_preview.required",
              actor: "system",
              title: "External prompt approval required",
              payload: {
                turnId,
                previewId: preview.id,
                bindingHash: preview.bindingHash,
                redactionCounts: preview.redactionCounts,
              },
              privacy: { labels: ["local"] },
            }),
          );
          this.dependencies.turns.updateState(turnId, "awaiting_approval", {
            contextPackId: contextPack.id,
          });
        });
        waitForApproval();
        yield { type: "context", contextPackId: contextPack.id, sourceCount: contextPack.items.length };
        yield { type: "approval_required", turnId, previewId: preview.id };
        return;
      }
      const activeModelCallId = createId("modelcall");
      modelCallId = activeModelCallId;
      const now = new Date().toISOString();
      const beginModelCall = this.dependencies.db.transaction(() => {
        this.dependencies.db
          .prepare(
            `INSERT INTO model_calls (
            id, workspace_id, provider_id, model_profile_id, context_pack_id,
            status, input_tokens, output_tokens, error_message, created_at, finished_at
          ) VALUES (
            @id, @workspaceId, @providerId, @modelProfileId, @contextPackId,
            'running', @inputTokens, NULL, NULL, @createdAt, NULL
          )`,
          )
          .run({
            id: activeModelCallId,
            workspaceId: building.workspaceId,
            providerId: profile.providerId,
            modelProfileId: profile.id,
            contextPackId: contextPack.id,
            inputTokens: contextPack.estimatedTokens,
            createdAt: now,
          });
        this.dependencies.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: building.workspaceId,
            type: "context_pack.created",
            actor: "system",
            title: "Built local context",
            payload: {
              turnId,
              contextPackId: contextPack.id,
              sourceCount: contextPack.items.length,
            },
            privacy: { labels: ["local"] },
          }),
        );
        this.dependencies.turns.updateState(turnId, "running", {
          contextPackId: contextPack.id,
          modelCallId: activeModelCallId,
        });
      });
      beginModelCall();

      yield {
        type: "context",
        contextPackId: contextPack.id,
        sourceCount: contextPack.items.length,
      };

      const prompt = buildPrompt(message, contextPack.items);
      for await (const chunk of provider.streamText({
        prompt,
        model: profile.model,
        signal,
      })) {
        signal.throwIfAborted();
        partialText += chunk.text;
        yield { type: "delta", text: chunk.text };
      }
      signal.throwIfAborted();

      const assistantEvent = createEvent({
        workspaceId: building.workspaceId,
        type: "assistant.response.created",
        actor: "assistant",
        title: "Future answered",
        payload: {
          turnId,
          responseText: partialText,
          contextPackId: contextPack.id,
        },
        privacy: { labels: ["local"] },
      });
      let completedTurn: AssistantTurnDto | undefined;
      const complete = this.dependencies.db.transaction(() => {
        this.dependencies.db
          .prepare(
            `UPDATE model_calls SET
            status = 'completed', output_tokens = @outputTokens,
            finished_at = @finishedAt WHERE id = @id`,
          )
          .run({
            id: modelCallId,
            outputTokens: estimateOutputTokens(partialText),
            finishedAt: new Date().toISOString(),
          });
        this.dependencies.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: building.workspaceId,
            type: "model_call.completed",
            actor: "assistant",
            title: "Model call completed",
            payload: {
              turnId,
              modelCallId,
              providerId: profile.providerId,
              model: profile.model,
              outputCharacters: partialText.length,
            },
            privacy: { labels: ["local"] },
          }),
        );
        this.dependencies.events.appendInCurrentTransaction(assistantEvent);
        this.dependencies.events.attachSourcesInCurrentTransaction(
          assistantEvent.id,
          contextPack.items.map((item) => item.source),
        );
        completedTurn = this.dependencies.turns.updateState(turnId, "completed", {
          assistantEventId: assistantEvent.id,
        });
      });
      complete();
      if (!completedTurn) throw new Error("assistant turn completion failed");

      const citations = contextPack.items.map((item) => item.source);
      yield {
        type: "completed",
        turn: completedTurn,
        event: { ...serializeTimelineEvent(assistantEvent), citations },
        citations,
      };
    } catch (error) {
      const cancelled = isAbortError(error);
      const current = this.dependencies.turns.get(turnId);
      if (!current) throw error;
      if (current.state === "completed" || current.state === "failed" || current.state === "cancelled") {
        throw error;
      }

      let terminalTurn: AssistantTurnDto | undefined;
      const finish = this.dependencies.db.transaction(() => {
        if (modelCallId) {
          this.dependencies.db
            .prepare(
              `UPDATE model_calls SET
              status = @status, output_tokens = @outputTokens,
              error_message = @errorMessage, finished_at = @finishedAt
             WHERE id = @id`,
            )
            .run({
              id: modelCallId,
              status: cancelled ? "cancelled" : "failed",
              outputTokens: estimateOutputTokens(partialText),
              errorMessage: cancelled ? null : "provider_error",
              finishedAt: new Date().toISOString(),
            });
          this.dependencies.events.appendInCurrentTransaction(
            createEvent({
              workspaceId: current.workspaceId,
              type: cancelled ? "model_call.cancelled" : "model_call.failed",
              actor: "assistant",
              title: cancelled ? "Model call cancelled" : "Model call failed",
              payload: {
                turnId,
                modelCallId,
                partialCharacters: partialText.length,
                ...(!cancelled ? { errorCode: "provider_error" } : {}),
              },
              privacy: { labels: ["local"] },
            }),
          );
        }
        this.dependencies.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: current.workspaceId,
            type: cancelled ? "assistant.turn.cancelled" : "assistant.turn.failed",
            actor: "assistant",
            title: cancelled ? "Assistant turn cancelled" : "Assistant turn failed",
            payload: {
              turnId,
              partialCharacters: partialText.length,
              ...(!cancelled ? { errorCode: "provider_error" } : {}),
            },
            privacy: { labels: ["local"] },
          }),
        );
        terminalTurn = this.dependencies.turns.updateState(
          turnId,
          cancelled ? "cancelled" : "failed",
          cancelled ? {} : { errorCode: "provider_error" },
        );
      });
      finish();
      if (!terminalTurn) throw new Error("assistant turn terminal update failed");

      if (cancelled) {
        yield { type: "cancelled", turn: terminalTurn };
      } else {
        yield {
          type: "failed",
          turn: terminalTurn,
          message: "The model provider could not complete this turn.",
        };
      }
    } finally {
      this.dependencies.cancellations.finish(turnId);
    }
  }

  private async *resumeApprovedTurn(initial: AssistantTurnDto): AsyncIterable<AssistantStreamFrame> {
    const preview = this.dependencies.promptPreviewService.getForTurn(initial.id);
    const contextPack = initial.contextPackId ? this.dependencies.contextService.get(initial.contextPackId) : undefined;
    if (!preview || !contextPack) throw new AssistantServiceError("turn_not_streamable");

    yield { type: "started", turn: initial };
    yield { type: "context", contextPackId: contextPack.id, sourceCount: contextPack.items.length };

    let decision;
    try {
      decision = this.dependencies.promptPreviewService.requireGrant(preview.id, {
        turnId: preview.turnId,
        providerId: preview.providerId,
        modelProfileId: preview.modelProfileId,
        model: preview.model,
        contextPackId: preview.contextPackId,
        contextPackHash: preview.contextPackHash,
        promptHash: preview.promptHash,
      });
    } catch (error) {
      if (error instanceof PromptPreviewServiceError && error.code === "grant_required") {
        yield { type: "approval_required", turnId: initial.id, previewId: preview.id };
        return;
      }
      throw error;
    }

    const { provider, profile } = this.dependencies.providerService.getRuntime(initial.modelProfileId);
    const signal = this.dependencies.cancellations.start(initial.id);
    const modelCallId = createId("modelcall");
    let partialText = "";

    try {
      const begin = this.dependencies.db.transaction(() => {
        this.dependencies.db
          .prepare(
            `INSERT INTO model_calls (
            id, workspace_id, provider_id, model_profile_id, context_pack_id,
            status, input_tokens, output_tokens, error_message, created_at, finished_at,
            prompt_preview_id, prompt_decision_id
          ) VALUES (
            @id, @workspaceId, @providerId, @modelProfileId, @contextPackId,
            'running', @inputTokens, NULL, NULL, @createdAt, NULL,
            @promptPreviewId, @promptDecisionId
          )`,
          )
          .run({
            id: modelCallId,
            workspaceId: initial.workspaceId,
            providerId: profile.providerId,
            modelProfileId: profile.id,
            contextPackId: contextPack.id,
            inputTokens: preview.estimatedTokens,
            createdAt: new Date().toISOString(),
            promptPreviewId: preview.id,
            promptDecisionId: decision.id,
          });
        this.dependencies.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: initial.workspaceId,
            type: "prompt_preview.approved",
            actor: "user",
            title: "External prompt approved",
            payload: {
              turnId: initial.id,
              previewId: preview.id,
              decisionId: decision.id,
              bindingHash: preview.bindingHash,
            },
            privacy: { labels: ["local"] },
          }),
        );
        this.dependencies.turns.updateState(initial.id, "running", { modelCallId });
      });
      begin();

      for await (const chunk of provider.streamText({
        prompt: preview.redactedPrompt,
        model: profile.model,
        signal,
      })) {
        signal.throwIfAborted();
        partialText += chunk.text;
        yield { type: "delta", text: chunk.text };
      }
      signal.throwIfAborted();

      const assistantEvent = createEvent({
        workspaceId: initial.workspaceId,
        type: "assistant.response.created",
        actor: "assistant",
        title: "Future answered",
        payload: { turnId: initial.id, responseText: partialText, contextPackId: contextPack.id },
        privacy: { labels: ["local"] },
      });
      let completedTurn: AssistantTurnDto | undefined;
      const complete = this.dependencies.db.transaction(() => {
        this.dependencies.db
          .prepare(
            `UPDATE model_calls SET status = 'completed', output_tokens = @outputTokens,
           finished_at = @finishedAt WHERE id = @id`,
          )
          .run({
            id: modelCallId,
            outputTokens: estimateOutputTokens(partialText),
            finishedAt: new Date().toISOString(),
          });
        this.dependencies.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: initial.workspaceId,
            type: "model_call.completed",
            actor: "assistant",
            title: "Model call completed",
            payload: {
              turnId: initial.id,
              modelCallId,
              providerId: profile.providerId,
              model: profile.model,
              previewId: preview.id,
              decisionId: decision.id,
              outputCharacters: partialText.length,
            },
            privacy: { labels: ["local"] },
          }),
        );
        this.dependencies.events.appendInCurrentTransaction(assistantEvent);
        this.dependencies.events.attachSourcesInCurrentTransaction(
          assistantEvent.id,
          contextPack.items.map((item) => item.source),
        );
        completedTurn = this.dependencies.turns.updateState(initial.id, "completed", {
          assistantEventId: assistantEvent.id,
        });
      });
      complete();
      if (!completedTurn) throw new Error("assistant turn completion failed");
      const citations = contextPack.items.map((item) => item.source);
      yield {
        type: "completed",
        turn: completedTurn,
        event: { ...serializeTimelineEvent(assistantEvent), citations },
        citations,
      };
    } catch (error) {
      const cancelled = isAbortError(error);
      const current = this.dependencies.turns.get(initial.id);
      if (!current || ["completed", "failed", "cancelled"].includes(current.state)) throw error;
      let terminalTurn: AssistantTurnDto | undefined;
      const finish = this.dependencies.db.transaction(() => {
        this.dependencies.db
          .prepare(
            `UPDATE model_calls SET status = @status, output_tokens = @outputTokens,
           error_message = @errorMessage, finished_at = @finishedAt WHERE id = @id`,
          )
          .run({
            id: modelCallId,
            status: cancelled ? "cancelled" : "failed",
            outputTokens: estimateOutputTokens(partialText),
            errorMessage: cancelled ? null : "provider_error",
            finishedAt: new Date().toISOString(),
          });
        this.dependencies.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: initial.workspaceId,
            type: cancelled ? "assistant.turn.cancelled" : "assistant.turn.failed",
            actor: "assistant",
            title: cancelled ? "Assistant turn cancelled" : "Assistant turn failed",
            payload: {
              turnId: initial.id,
              partialCharacters: partialText.length,
              ...(!cancelled ? { errorCode: "provider_error" } : {}),
            },
            privacy: { labels: ["local"] },
          }),
        );
        terminalTurn = this.dependencies.turns.updateState(
          initial.id,
          cancelled ? "cancelled" : "failed",
          cancelled ? {} : { errorCode: "provider_error" },
        );
      });
      finish();
      if (!terminalTurn) throw new Error("assistant turn terminal update failed");
      yield cancelled
        ? { type: "cancelled", turn: terminalTurn }
        : { type: "failed", turn: terminalTurn, message: "The model provider could not complete this turn." };
    } finally {
      this.dependencies.cancellations.finish(initial.id);
    }
  }

  cancelTurn(turnId: string): AssistantTurnDto {
    const turn = this.dependencies.turns.get(turnId);
    if (!turn) throw new AssistantServiceError("turn_not_found");
    if (["completed", "failed", "cancelled"].includes(turn.state)) {
      throw new AssistantServiceError("turn_terminal");
    }
    if (this.dependencies.cancellations.cancel(turnId)) return turn;
    if (turn.state !== "queued" && turn.state !== "awaiting_approval") {
      throw new AssistantServiceError("turn_not_active");
    }
    if (turn.state === "awaiting_approval") {
      const preview = this.dependencies.promptPreviewService.getForTurn(turnId);
      if (preview) this.dependencies.promptPreviewService.invalidate(preview.id);
    }

    const cancel = this.dependencies.db.transaction(() => {
      this.dependencies.events.appendInCurrentTransaction(
        createEvent({
          workspaceId: turn.workspaceId,
          type: "assistant.turn.cancelled",
          actor: "assistant",
          title: "Assistant turn cancelled",
          payload: { turnId, partialCharacters: 0 },
          privacy: { labels: ["local"] },
        }),
      );
      return this.dependencies.turns.updateState(turnId, "cancelled");
    });
    return cancel();
  }

  denyTurnForPreview(previewId: string): AssistantTurnDto {
    const preview = this.dependencies.promptPreviewService.get(previewId);
    const decision = this.dependencies.promptPreviewService.getDecision(previewId);
    if (!preview || decision?.decision !== "denied") {
      throw new AssistantServiceError("turn_not_active");
    }
    const turn = this.dependencies.turns.get(preview.turnId);
    if (!turn || turn.state !== "awaiting_approval") {
      throw new AssistantServiceError("turn_not_active");
    }
    let deniedTurn: AssistantTurnDto | undefined;
    const deny = this.dependencies.db.transaction(() => {
      this.dependencies.events.appendInCurrentTransaction(
        createEvent({
          workspaceId: turn.workspaceId,
          type: "prompt_preview.denied",
          actor: "user",
          title: "External prompt denied",
          payload: {
            turnId: turn.id,
            previewId,
            decisionId: decision.id,
            bindingHash: decision.bindingHash,
          },
          privacy: { labels: ["local"] },
        }),
      );
      this.dependencies.events.appendInCurrentTransaction(
        createEvent({
          workspaceId: turn.workspaceId,
          type: "assistant.turn.failed",
          actor: "assistant",
          title: "Assistant turn denied",
          payload: { turnId: turn.id, errorCode: "grant_denied" },
          privacy: { labels: ["local"] },
        }),
      );
      deniedTurn = this.dependencies.turns.updateState(turn.id, "failed", {
        errorCode: "grant_denied",
      });
    });
    deny();
    if (!deniedTurn) throw new Error("assistant denial failed");
    return deniedTurn;
  }

  private getUserMessage(eventId: string): string {
    const row = this.dependencies.db
      .prepare<{ id: string }, UserEventRow>("SELECT payload_json FROM events WHERE id = @id")
      .get({ id: eventId });
    const payload = row ? (JSON.parse(row.payload_json) as Record<string, unknown>) : undefined;
    if (typeof payload?.text !== "string") throw new Error("assistant user message missing");
    return payload.text;
  }
}

function buildPrompt(message: string, items: Array<{ text: string }>): string {
  if (items.length === 0) return message;
  const context = items.map((item, index) => `[${index + 1}] ${item.text}`).join("\n");
  return `${message}\n\nLocal context:\n${context}`;
}

function estimateOutputTokens(text: string): number {
  return text ? Math.max(1, Math.ceil(text.length / 4)) : 0;
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
