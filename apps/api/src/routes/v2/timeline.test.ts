import { describe, expect, it } from "vitest";
import { createServer } from "../../server/create-server";

describe("V2 timeline routes", () => {
  it("requires a workspace and returns serialized persisted events", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const missing = await server.inject({ method: "GET", url: "/api/v2/timeline" });
    expect(missing.statusCode).toBe(400);

    const workspace = await server.inject({ method: "POST", url: "/api/v2/workspaces", headers: { "x-future-session": "test-token" }, payload: { name: "Timeline", privacyMode: "standard" } });
    const workspaceId = workspace.json<{ id: string }>().id;
    const response = await server.inject({ method: "GET", url: `/api/v2/timeline?workspaceId=${workspaceId}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      events: [expect.objectContaining({ type: "workspace.created", createdAt: expect.any(String), citations: [] })],
      nextCursor: expect.any(String)
    });
    await server.close();
  });
});
