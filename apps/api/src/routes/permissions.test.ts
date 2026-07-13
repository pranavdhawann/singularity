import { describe, expect, it } from "vitest";
import { createServer } from "../server/create-server";

describe("permission routes", () => {
  it("rejects unsupported permission decisions", async () => {
    const server = await createServer({ databasePath: ":memory:" });

    const workspaceResponse = await server.inject({
      method: "POST",
      url: "/api/workspaces",
      payload: { name: "Permission Validation Demo" },
    });
    const workspace = workspaceResponse.json<{ id: string }>();

    const requestResponse = await server.inject({
      method: "POST",
      url: "/api/permission-requests",
      payload: {
        workspaceId: workspace.id,
        capability: "use_external_models",
        reason: "Prompt preview approved",
      },
    });
    const permissionRequest = requestResponse.json<{ id: string }>();

    const decideResponse = await server.inject({
      method: "POST",
      url: `/api/permission-requests/${permissionRequest.id}/decide`,
      payload: {
        decision: "maybe",
      },
    });

    await server.close();

    expect(decideResponse.statusCode).toBe(400);
  });

  it("records a permission decision and creates a workspace rule", async () => {
    const server = await createServer({ databasePath: ":memory:" });

    const workspaceResponse = await server.inject({
      method: "POST",
      url: "/api/workspaces",
      payload: { name: "Permission Demo" },
    });
    const workspace = workspaceResponse.json<{ id: string }>();

    const requestResponse = await server.inject({
      method: "POST",
      url: "/api/permission-requests",
      payload: {
        workspaceId: workspace.id,
        capability: "use_external_models",
        reason: "Prompt preview approved",
        dataAccess: { provider: "mock" },
      },
    });
    const permissionRequest = requestResponse.json<{ id: string }>();

    const decideResponse = await server.inject({
      method: "POST",
      url: `/api/permission-requests/${permissionRequest.id}/decide`,
      payload: {
        decision: "granted",
        state: "allow_for_workspace",
      },
    });

    const listResponse = await server.inject({
      method: "GET",
      url: `/api/permissions?workspaceId=${workspace.id}`,
    });

    await server.close();

    expect(requestResponse.statusCode).toBe(201);
    expect(decideResponse.statusCode).toBe(200);
    expect(listResponse.json<{ rules: Array<{ capability: string; state: string }> }>().rules).toEqual([
      expect.objectContaining({
        capability: "use_external_models",
        state: "allow_for_workspace",
      }),
    ]);
  });
});
