import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FutureApi } from "../../app/api-types";
import { ContextInspector } from "./ContextInspector";

describe("ContextInspector", () => {
  it("loads exact immutable source and model metadata", async () => {
    const api = {
      getContextPack: vi.fn(async () => ({
        id: "ctx_1",
        workspaceId: "w_1",
        turnId: "turn_1",
        modelProfileId: "profile_1",
        providerId: "provider_1",
        model: "mock",
        items: [{
          source: { kind: "timeline_event" as const, id: "evt_1", workspaceId: "w_1", title: "Prior answer", contentHash: "abc" },
          text: "Earlier context",
          tokenCount: 3,
          score: 8
        }],
        estimatedTokens: 12,
        redactionCount: 0,
        createdAt: "2026-07-10T12:00:00.000Z"
      }))
    } as unknown as FutureApi;

    render(<ContextInspector api={api} contextPackId="ctx_1" />);

    expect(await screen.findByText(/Prior answer/)).toBeInTheDocument();
    expect(screen.getByText("Model: mock")).toBeInTheDocument();
    expect(screen.getByText("12 estimated tokens")).toBeInTheDocument();
    expect(screen.getByText("Timeline event")).toBeInTheDocument();
  });
});
