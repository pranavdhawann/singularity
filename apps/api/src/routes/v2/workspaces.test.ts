import { describe, expect, it } from "vitest";
import { createServer } from "../../server/create-server";

const sessionHeaders = { "x-future-session": "test-token" };

describe("V2 workspace routes", () => {
  it("creates and lists a workspace with a timeline event", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const createResponse = await server.inject({
      method: "POST",
      url: "/api/v2/workspaces",
      headers: sessionHeaders,
      payload: {
        name: "Future V2",
        privacyMode: "local_only",
      },
    });
    const workspace = createResponse.json<{ id: string; name: string; privacyMode: string }>();
    const listResponse = await server.inject({ method: "GET", url: "/api/v2/workspaces" });
    const timelineResponse = await server.inject({
      method: "GET",
      url: `/api/timeline?workspaceId=${workspace.id}`,
    });

    expect(createResponse.statusCode).toBe(201);
    expect(workspace).toEqual(expect.objectContaining({ name: "Future V2", privacyMode: "local_only" }));
    expect(listResponse.json()).toEqual({ workspaces: [expect.objectContaining({ id: workspace.id })] });
    expect(timelineResponse.json<{ events: Array<{ type: string }> }>().events).toEqual([
      expect.objectContaining({ type: "workspace.created" }),
    ]);

    await server.close();
  });

  it("rejects extra workspace properties", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const response = await server.inject({
      method: "POST",
      url: "/api/v2/workspaces",
      headers: sessionHeaders,
      payload: { name: "Invalid", privacyMode: "standard", surprise: true },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: expect.objectContaining({ code: "validation_error" }) });
    await server.close();
  });
});
