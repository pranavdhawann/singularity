import { describe, expect, it } from "vitest";
import { buildContextPack } from "./context-pack";

describe("buildContextPack", () => {
  it("deduplicates citable sources and keeps diverse items inside the token budget", () => {
    const pack = buildContextPack({
      command: "What did we decide?",
      budgetTokens: 80,
      memories: [
        {
          source: { kind: "memory", id: "mem_1", workspaceId: "w_demo", title: "Decision", contentHash: "a" },
          text: "Use SQLite as the source of truth.",
          tokenCount: 9,
          score: 10
        },
        {
          source: { kind: "memory", id: "mem_1", workspaceId: "w_demo", title: "Older label", contentHash: "a" },
          text: "Duplicate SQLite decision.",
          tokenCount: 5,
          score: 2
        }
      ],
      chunks: [
        {
          source: { kind: "document_chunk", id: "chunk_1", workspaceId: "w_demo", title: "Architecture", contentHash: "b" },
          text: "The database is local.",
          tokenCount: 5,
          score: 8
        }
      ],
      recentEvents: [
        {
          source: { kind: "timeline_event", id: "evt_1", workspaceId: "w_demo", title: "Prior answer", contentHash: "c" },
          text: "We agreed on SQLite.",
          tokenCount: 5,
          score: 7
        }
      ]
    });

    expect(pack.items.map((item) => item.source.kind)).toEqual([
      "memory",
      "document_chunk",
      "timeline_event"
    ]);
    expect(pack.items.filter((item) => item.source.id === "mem_1")).toHaveLength(1);
    expect(pack.estimatedTokens).toBeLessThanOrEqual(80);
  });
});
