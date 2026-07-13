import { describe, expect, it } from "vitest";
import { createServer } from "../../server/create-server";

const headers = { "x-future-session": "test-token" };

describe("V2 search and compaction routes", () => {
  it("searches workspace memory and creates a source-linked compaction", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const memory = (
      await server.inject({
        method: "POST",
        url: "/api/v2/memories",
        headers,
        payload: {
          workspaceId: "w_1",
          type: "fact",
          statement: "SQLite local source",
          confidence: 1,
          reviewState: "approved",
          sourceIds: [],
        },
      })
    ).json<{ id: string }>();
    const search = await server.inject({ method: "GET", url: "/api/v2/search?workspaceId=w_1&query=SQLite" });
    const result = search.json<{ results: Array<{ id: string; contentHash: string }>; retrieval: unknown }>();
    expect(result.results).toEqual([expect.objectContaining({ id: memory.id })]);
    expect(result.retrieval).toEqual({ mode: "lexical", fallbackReason: "inspection_only" });
    const compaction = await server.inject({
      method: "POST",
      url: "/api/v2/memory-compactions",
      headers,
      payload: {
        workspaceId: "w_1",
        summary: "SQLite remains local",
        sources: [{ kind: "memory", id: memory.id, contentHash: result.results[0]!.contentHash }],
      },
    });
    expect(compaction.statusCode).toBe(201);
    expect(compaction.json()).toEqual(
      expect.objectContaining({ sources: [expect.objectContaining({ id: memory.id })] }),
    );
    await server.close();
  });
});
