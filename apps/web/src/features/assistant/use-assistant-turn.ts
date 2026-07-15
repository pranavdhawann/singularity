import type { PromptPreviewDto } from "@future/core";
import { useCallback, useRef, useState } from "react";
import type { FutureApi } from "../../app/api-types";

export type AssistantTurnStatus =
  "idle" | "creating" | "streaming" | "awaiting_approval" | "completed" | "failed" | "cancelled";

interface UseAssistantTurnOptions {
  api: FutureApi;
  onTimelineChanged(): void | Promise<void>;
  onContextSelected(contextPackId: string): void;
}

interface SubmitAssistantTurnInput {
  workspaceId: string;
  modelProfileId: string;
  message: string;
}

export function useAssistantTurn(options: UseAssistantTurnOptions) {
  const [status, setStatus] = useState<AssistantTurnStatus>("idle");
  const [turnId, setTurnId] = useState<string | undefined>(undefined);
  const [streamedText, setStreamedText] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [redactionCounts, setRedactionCounts] = useState<Record<string, number>>({});
  const [promptPreview, setPromptPreview] = useState<PromptPreviewDto | undefined>();
  const activeTurn = useRef<string | undefined>(undefined);
  const workspaceRef = useRef<string | undefined>(undefined);

  const consume = useCallback(
    async (id: string): Promise<"approval" | "terminal"> => {
      for await (const frame of options.api.streamAssistantTurn(id)) {
        if (frame.type === "delta") {
          setStreamedText((current) => current + frame.text);
        } else if (frame.type === "context") {
          setRedactionCounts(frame.redactionCounts);
        } else if (frame.type === "approval_required") {
          if (!workspaceRef.current) throw new Error("Workspace is unavailable for prompt approval");
          const preview = await options.api.getPromptPreview(frame.previewId, workspaceRef.current);
          setPromptPreview(preview);
          setStatus("awaiting_approval");
          return "approval";
        } else if (frame.type === "completed") {
          setStatus("completed");
          options.onContextSelected(frame.turn.contextPackId ?? "");
          await options.onTimelineChanged();
        } else if (frame.type === "failed") {
          setStatus("failed");
          setError(frame.message);
          await options.onTimelineChanged();
        } else if (frame.type === "cancelled") {
          setStatus("cancelled");
          await options.onTimelineChanged();
        }
      }
      return "terminal";
    },
    [options],
  );

  const submit = useCallback(
    async (input: SubmitAssistantTurnInput) => {
      if (activeTurn.current) return;
      setStatus("creating");
      setStreamedText("");
      setError(undefined);
      setRedactionCounts({});
      setPromptPreview(undefined);
      workspaceRef.current = input.workspaceId;
      let result: "approval" | "terminal" = "terminal";
      try {
        const created = await options.api.createAssistantTurn({
          ...input,
          idempotencyKey: crypto.randomUUID(),
        });
        activeTurn.current = created.turn.id;
        setTurnId(created.turn.id);
        setStatus("streaming");
        result = await consume(created.turn.id);
      } catch (cause) {
        setStatus("failed");
        setError(cause instanceof Error ? cause.message : "Assistant turn failed");
        await options.onTimelineChanged();
      } finally {
        if (result !== "approval") activeTurn.current = undefined;
      }
    },
    [consume, options],
  );

  const approvePrompt = useCallback(async () => {
    if (!promptPreview || !activeTurn.current || !workspaceRef.current) return;
    try {
      await options.api.decidePromptPreview(
        promptPreview.id,
        workspaceRef.current,
        "approved",
        promptPreview.bindingHash,
      );
      setPromptPreview(undefined);
      setStatus("streaming");
      await consume(activeTurn.current);
    } catch (cause) {
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : "Prompt approval failed");
    } finally {
      activeTurn.current = undefined;
    }
  }, [consume, options.api, promptPreview]);

  const denyPrompt = useCallback(async () => {
    if (!promptPreview || !workspaceRef.current) return;
    try {
      await options.api.decidePromptPreview(
        promptPreview.id,
        workspaceRef.current,
        "denied",
        promptPreview.bindingHash,
      );
      setStatus("failed");
      setError("External prompt denied.");
      setPromptPreview(undefined);
      await options.onTimelineChanged();
    } catch (cause) {
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : "Prompt denial failed");
    } finally {
      activeTurn.current = undefined;
    }
  }, [options, promptPreview]);

  const cancel = useCallback(async () => {
    if (!activeTurn.current) return;
    await options.api.cancelAssistantTurn(activeTurn.current);
  }, [options.api]);

  return {
    status,
    turnId,
    streamedText,
    error,
    redactionCounts,
    promptPreview,
    submit,
    cancel,
    approvePrompt,
    denyPrompt,
  };
}
