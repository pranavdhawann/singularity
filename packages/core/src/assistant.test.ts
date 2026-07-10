import { describe, expect, it } from "vitest";
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
});
