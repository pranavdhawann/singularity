import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PromptPreviewDto } from "@future/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalPromptPreview } from "./ExternalPromptPreview";

afterEach(cleanup);

const preview: PromptPreviewDto = {
  id: "preview_1",
  workspaceId: "w_1",
  turnId: "turn_1",
  providerId: "External Provider",
  modelProfileId: "profile_1",
  model: "model-1",
  endpointClassification: "external",
  contextPackId: "ctx_1",
  contextPackHash: "ctx-hash",
  redactedPrompt: "Email [REDACTED_EMAIL]",
  promptHash: "prompt-hash",
  bindingHash: "binding-hash",
  estimatedTokens: 8,
  privacyLabels: ["private"],
  redactionCounts: { email: 1 },
  selectedSources: [
    { kind: "document_chunk", id: "chunk_1", workspaceId: "w_1", title: "Notes", contentHash: "chunk-hash" },
  ],
  excludedSources: [],
  createdAt: "2026-07-11T00:00:00.000Z",
  expiresAt: "2026-07-11T00:05:00.000Z",
};

describe("ExternalPromptPreview", () => {
  it("shows exact redacted text and all immutable approval metadata", () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    render(<ExternalPromptPreview preview={preview} onApprove={onApprove} onDeny={onDeny} />);

    expect(screen.getByText("Email [REDACTED_EMAIL]")).toBeInTheDocument();
    expect(screen.getByText("model-1")).toBeInTheDocument();
    expect(screen.getByText("external")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText(/email: 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve exact prompt" }));
    fireEvent.click(screen.getByRole("button", { name: "Deny external prompt" }));
    expect(onApprove).toHaveBeenCalled();
    expect(onDeny).toHaveBeenCalled();
  });

  it("focuses the safe deny control when the dialog opens", () => {
    render(<ExternalPromptPreview preview={preview} onApprove={vi.fn()} onDeny={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Deny external prompt" })).toHaveFocus();
  });

  it("denies the external prompt when Escape is pressed", () => {
    const onDeny = vi.fn();
    render(<ExternalPromptPreview preview={preview} onApprove={vi.fn()} onDeny={onDeny} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onDeny).toHaveBeenCalled();
  });

  it("cycles focus with Tab and Shift+Tab inside the dialog", () => {
    render(<ExternalPromptPreview preview={preview} onApprove={vi.fn()} onDeny={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    const deny = screen.getByRole("button", { name: "Deny external prompt" });
    const approve = screen.getByRole("button", { name: "Approve exact prompt" });

    // Deny is the first focusable control; Shift+Tab wraps to the last (Approve).
    expect(deny).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(approve).toHaveFocus();

    // Tab from the last control wraps back to the first (Deny).
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(deny).toHaveFocus();
  });

  it("restores focus to the initiating control after the dialog closes", () => {
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button type="button">Ask the assistant</button>
          {open ? <ExternalPromptPreview preview={preview} onApprove={vi.fn()} onDeny={vi.fn()} /> : null}
        </>
      );
    }

    const { rerender } = render(<Harness open={false} />);
    const trigger = screen.getByRole("button", { name: "Ask the assistant" });
    trigger.focus();
    expect(trigger).toHaveFocus();

    rerender(<Harness open={true} />);
    expect(screen.getByRole("button", { name: "Deny external prompt" })).toHaveFocus();

    rerender(<Harness open={false} />);
    expect(trigger).toHaveFocus();
  });
});
