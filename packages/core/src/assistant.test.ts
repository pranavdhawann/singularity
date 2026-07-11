import { describe, expect, it } from "vitest";
import type { AssistantStreamFrame, ContextPackInspection } from "./assistant";
import { createEvent } from "./events";
import { serializeTimelineEvent, sourceReferenceKey } from "./assistant";

describe("assistant contracts", () => {
  it("serializes timeline event dates for the V2 API", () => {
    const serialized = serializeTimelineEvent(
      createEvent({
        workspaceId: "w_demo",
        type: "user.message.created",
        actor: "user",
        title: "Asked Future",
        payload: { text: "What did we decide?" },
        privacy: { labels: ["local"] }
      })
    );

    expect(serialized.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(serialized.payload).toEqual({ text: "What did we decide?" });
  });

  it("creates stable source keys independent of display metadata", () => {
    expect(
      sourceReferenceKey({
        kind: "memory",
        id: "mem_1",
        workspaceId: "w_demo",
        title: "Decision",
        contentHash: "abc"
      })
    ).toBe("memory:mem_1:abc");

    expect(
      sourceReferenceKey({
        kind: "document_chunk",
        id: "chunk_1",
        workspaceId: "w_demo",
        title: "Architecture",
        contentHash: "def",
        range: { start: 10, end: 25 }
      })
    ).toBe("document_chunk:chunk_1:def:10-25");
  });

  it("carries channel scores and ranking reasons", () => {
    const pack = {
      id: "ctx_1", workspaceId: "w_1", turnId: "turn_1",
      modelProfileId: "profile_1", providerId: "provider_1", model: "mock",
      items: [{
        source: { kind: "memory", id: "mem_1", workspaceId: "w_1", title: "Decision", contentHash: "hash_1" },
        text: "Use SQLite", tokenCount: 3, score: 0.74,
        retrieval: { lexicalScore: 0.8, vectorScore: 0.6, finalScore: 0.74, reasons: ["lexical", "pinned"] }
      }],
      estimatedTokens: 3, redactionCount: 0,
      retrieval: { mode: "hybrid", fallbackReason: null },
      createdAt: "2026-07-11T12:00:00.000Z"
    } satisfies ContextPackInspection;
    expect(pack.items[0]?.retrieval.reasons).toEqual(["lexical", "pinned"]);
  });

  it("represents an external turn waiting for immutable approval", () => {
    const frame = {
      type: "approval_required",
      turnId: "turn_1",
      previewId: "preview_1"
    } satisfies AssistantStreamFrame;

    expect(frame).toEqual({
      type: "approval_required",
      turnId: "turn_1",
      previewId: "preview_1"
    });
  });
});
