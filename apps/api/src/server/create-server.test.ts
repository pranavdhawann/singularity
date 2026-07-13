import { describe, expect, it } from "vitest";
import { createServer } from "./create-server";

describe("createServer", () => {
  it("serves health", async () => {
    const server = await createServer({ databasePath: ":memory:" });
    const response = await server.inject({ method: "GET", url: "/api/health" });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("creates a workspace and records it in the timeline", async () => {
    const server = await createServer({ databasePath: ":memory:" });

    const createResponse = await server.inject({
      method: "POST",
      url: "/api/workspaces",
      payload: {
        name: "Future Demo",
        kind: "project",
        rootPath: "C:/work/future",
        privacyMode: "standard",
      },
    });

    const workspace = createResponse.json<{ id: string; name: string }>();
    const timelineResponse = await server.inject({
      method: "GET",
      url: `/api/timeline?workspaceId=${workspace.id}`,
    });

    await server.close();

    expect(createResponse.statusCode).toBe(201);
    expect(workspace.name).toBe("Future Demo");
    expect(timelineResponse.statusCode).toBe(200);
    expect(timelineResponse.json<{ events: Array<{ type: string }> }>().events).toEqual([
      expect.objectContaining({ type: "workspace.created" }),
    ]);
  });
});
