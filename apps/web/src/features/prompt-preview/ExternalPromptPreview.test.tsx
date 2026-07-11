import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExternalPromptPreview } from "./ExternalPromptPreview";

describe("ExternalPromptPreview", () => {
  it("shows exact redacted text and all immutable approval metadata", () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    render(<ExternalPromptPreview preview={{
      id: "preview_1", workspaceId: "w_1", turnId: "turn_1",
      providerId: "External Provider", modelProfileId: "profile_1", model: "model-1",
      endpointClassification: "external", contextPackId: "ctx_1", contextPackHash: "ctx-hash",
      redactedPrompt: "Email [REDACTED_EMAIL]", promptHash: "prompt-hash",
      bindingHash: "binding-hash", estimatedTokens: 8, privacyLabels: ["private"],
      redactionCounts: { email: 1 }, selectedSources: [{
        kind: "document_chunk", id: "chunk_1", workspaceId: "w_1",
        title: "Notes", contentHash: "chunk-hash"
      }], excludedSources: [], createdAt: "2026-07-11T00:00:00.000Z",
      expiresAt: "2026-07-11T00:05:00.000Z"
    }} onApprove={onApprove} onDeny={onDeny} />);

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
});
