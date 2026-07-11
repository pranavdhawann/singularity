import { useEffect, useState } from "react";
import type { AssistantTurnStatus } from "./use-assistant-turn";

interface AssistantComposerProps {
  status: AssistantTurnStatus;
  error?: string | undefined;
  onSubmit(message: string): void | Promise<void>;
  onCancel(): void | Promise<void>;
}

export function AssistantComposer({ status, error, onSubmit, onCancel }: AssistantComposerProps) {
  const [message, setMessage] = useState("");
  const active = status === "creating" || status === "streaming";

  useEffect(() => {
    if (status === "completed") setMessage("");
  }, [status]);

  return (
    <form
      className="assistant-composer"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = message.trim();
        if (trimmed && !active) void onSubmit(trimmed);
      }}
    >
      <label htmlFor="assistant-message">Message Future</label>
      <div className="composer-row">
        <textarea
          id="assistant-message"
          value={message}
          disabled={active}
          rows={3}
          placeholder="Ask Future anything about your local context"
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !active) {
              event.preventDefault();
              const trimmed = message.trim();
              if (trimmed) void onSubmit(trimmed);
            }
          }}
        />
        {active ? (
          <button type="button" className="cancel-button" onClick={() => void onCancel()}>
            Cancel
          </button>
        ) : (
          <button type="submit" disabled={!message.trim()}>Send</button>
        )}
      </div>
      {status === "streaming" ? <p className="composer-status">Future is responding...</p> : null}
      {status === "cancelled" ? <p className="turn-cancelled">Turn cancelled.</p> : null}
      {error ? <p className="turn-error" role="alert">{error}</p> : null}
    </form>
  );
}
