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
          source: { kind: "compaction" as const, id: "cmp_1", workspaceId: "w_1", title: "Compacted decision", contentHash: "abc" },
          text: "Earlier context",
          tokenCount: 3,
          score: 0.74,
          retrieval: { lexicalScore: 0.8, vectorScore: 0.6, finalScore: 0.74,
            reasons: ["lexical", "vector", "source_quality"] },
          compactionSources: [{ kind: "memory" as const, id: "mem_1", workspaceId: "w_1",
            title: "Compaction source", contentHash: "def" }]
        }],
        estimatedTokens: 12,
        redactionCount: 0,
        retrieval: { mode: "lexical" as const, fallbackReason: "unavailable" },
        createdAt: "2026-07-10T12:00:00.000Z"
      }))
    } as unknown as FutureApi;

    render(<ContextInspector api={api} contextPackId="ctx_1" />);

    expect(await screen.findByText(/Compacted decision/)).toBeInTheDocument();
    expect(screen.getByText("Model: mock")).toBeInTheDocument();
    expect(screen.getByText("12 estimated tokens")).toBeInTheDocument();
    expect(screen.getByText("Compaction")).toBeInTheDocument();
    expect(screen.getByText("Final score 0.740")).toBeInTheDocument();
    expect(screen.getByText("Lexical 0.800 · Vector 0.600")).toBeInTheDocument();
    expect(screen.getByText("lexical, vector, source quality")).toBeInTheDocument();
    expect(screen.getByText("Lexical retrieval only (unavailable)")).toBeInTheDocument();
    expect(screen.getByText("Compacted from memory mem_1")).toBeInTheDocument();
  });
});
