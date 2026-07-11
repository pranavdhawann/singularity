import { describe, expect, it } from "vitest";
import { rankHybridCandidates, type HybridRetrievalCandidate } from "./hybrid";

function candidate(overrides: Partial<HybridRetrievalCandidate> & Pick<HybridRetrievalCandidate, "id" | "kind">): HybridRetrievalCandidate {
  return {
    workspaceId: "w_1", title: overrides.id, text: `${overrides.id} text`, tokenCount: 3,
    contentHash: `hash_${overrides.id}`, lexicalScore: 0, ...overrides
  };
}

describe("rankHybridCandidates", () => {
  it("supports lexical-only and fuses vectors with explicit reasons", () => {
    const lexical = rankHybridCandidates({ workspaceId: "w_1", candidates: [
      candidate({ kind: "memory", id: "lex", lexicalScore: 1, confidence: 1 }),
      candidate({ kind: "document_chunk", id: "vec", lexicalScore: 0.2 })
    ] });
    expect(lexical[0]?.source.id).toBe("lex");
    expect(lexical[0]?.retrieval.reasons).toContain("lexical");

    const hybrid = rankHybridCandidates({ workspaceId: "w_1", candidates: [
      candidate({ kind: "memory", id: "lex", lexicalScore: 1, vectorScore: 0 }),
      candidate({ kind: "document_chunk", id: "vec", lexicalScore: 0.5, vectorScore: 1 })
    ] });
    expect(hybrid.find((item) => item.source.id === "vec")?.retrieval.reasons).toContain("vector");
    expect(hybrid.find((item) => item.source.id === "vec")?.retrieval.vectorScore).toBe(1);
  });

  it("filters unauthorized and compacted sources and boosts pinned memories", () => {
    const results = rankHybridCandidates({ workspaceId: "w_1",
      suppressedSourceKeys: ["timeline_event:old:hash_old"], candidates: [
        candidate({ kind: "memory", id: "pinned", lexicalScore: 0.4, pinned: true }),
        candidate({ kind: "memory", id: "plain", lexicalScore: 0.5 }),
        candidate({ kind: "timeline_event", id: "old", lexicalScore: 1 }),
        candidate({ kind: "document_chunk", id: "other", workspaceId: "w_2", lexicalScore: 1 })
      ] });
    expect(results.map((item) => item.source.id)).toEqual(["pinned", "plain"]);
    expect(results[0]?.retrieval.reasons).toContain("pinned");
  });

  it("keeps source diversity and stable tie ordering", () => {
    const candidates = [
      candidate({ kind: "memory", id: "b", lexicalScore: 1 }),
      candidate({ kind: "memory", id: "a", lexicalScore: 1 }),
      candidate({ kind: "document_chunk", id: "doc", lexicalScore: 0.4 }),
      candidate({ kind: "timeline_event", id: "evt", lexicalScore: 0.3 })
    ];
    const first = rankHybridCandidates({ workspaceId: "w_1", candidates });
    const second = rankHybridCandidates({ workspaceId: "w_1", candidates });
    expect(first.map((item) => item.source.id)).toEqual(second.map((item) => item.source.id));
    expect(first.slice(0, 3).map((item) => item.source.kind)).toEqual(
      expect.arrayContaining(["memory", "document_chunk", "timeline_event"])
    );
  });
});
