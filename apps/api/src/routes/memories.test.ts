import { describe, expect, it } from "vitest";
import { createServer } from "../server/create-server";

describe("memory routes", () => {
  it("creates, promotes, and lists an approved memory", async () => {
    const server = await createServer({ databasePath: ":memory:" });

    const workspaceResponse = await server.inject({
      method: "POST",
      url: "/api/workspaces",
      payload: { name: "Memory Demo" }
    });
    const workspace = workspaceResponse.json<{ id: string }>();

    const createResponse = await server.inject({
      method: "POST",
      url: "/api/memories",
      payload: {
        workspaceId: workspace.id,
        type: "fact",
        statement: "Future uses SQLite for local truth.",
        confidence: 0.92
      }
    });
    const created = createResponse.json<{ id: string; reviewState: string }>();

    const promoteResponse = await server.inject({
      method: "POST",
      url: `/api/memories/${created.id}/promote`
    });
    const promoted = promoteResponse.json<{ reviewState: string }>();

    const listResponse = await server.inject({
      method: "GET",
      url: `/api/memories?workspaceId=${workspace.id}&reviewState=approved`
    });

    await server.close();

    expect(createResponse.statusCode).toBe(201);
    expect(created.reviewState).toBe("proposed");
    expect(promoteResponse.statusCode).toBe(200);
    expect(promoted.reviewState).toBe("approved");
    expect(listResponse.json<{ memories: Array<{ statement: string }> }>().memories).toEqual([
      expect.objectContaining({ statement: "Future uses SQLite for local truth." })
    ]);
  });
});
