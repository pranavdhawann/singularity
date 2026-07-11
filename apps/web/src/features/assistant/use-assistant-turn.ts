import { useCallback, useRef, useState } from "react";
import type { FutureApi } from "../../app/api-types";

export type AssistantTurnStatus =
  | "idle"
  | "creating"
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled";

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
  const activeTurn = useRef<string | undefined>(undefined);

  const submit = useCallback(async (input: SubmitAssistantTurnInput) => {
    if (activeTurn.current) return;
    setStatus("creating");
    setStreamedText("");
    setError(undefined);
    try {
      const created = await options.api.createAssistantTurn({
        ...input,
        idempotencyKey: crypto.randomUUID()
      });
      activeTurn.current = created.turn.id;
      setTurnId(created.turn.id);
      setStatus("streaming");
      for await (const frame of options.api.streamAssistantTurn(created.turn.id)) {
        if (frame.type === "delta") {
          setStreamedText((current) => current + frame.text);
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
    } catch (cause) {
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : "Assistant turn failed");
      await options.onTimelineChanged();
    } finally {
      activeTurn.current = undefined;
    }
  }, [options]);

  const cancel = useCallback(async () => {
    if (!activeTurn.current) return;
    await options.api.cancelAssistantTurn(activeTurn.current);
  }, [options.api]);

  return { status, turnId, streamedText, error, submit, cancel };
}
