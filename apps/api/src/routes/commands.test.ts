import { describe, expect, it } from "vitest";
import { createServer } from "../server/create-server";

describe("command routes", () => {
  it("blocks non-local model calls until permission is granted", async () => {
    const server = await createServer({ databasePath: ":memory:" });
    const workspaceResponse = await server.inject({
      method: "POST",
      url: "/api/workspaces",
      payload: { name: "Command Permission Demo" }
    });
    const workspace = workspaceResponse.json<{ id: string }>();

    const commandResponse = await server.inject({
      method: "POST",
      url: "/api/commands",
      payload: {
        workspaceId: workspace.id,
        command: "ask_with_memory",
        input: "Use an external model",
        providerId: "openai-compatible"
      }
    });

    await server.close();

    expect(commandResponse.statusCode).toBe(403);
    expect(commandResponse.json<{ error: string; permissionRequestId: string }>()).toEqual(
      expect.objectContaining({
        error: "permission_required",
        permissionRequestId: expect.stringMatching(/^permreq_/)
      })
    );
  });
});
