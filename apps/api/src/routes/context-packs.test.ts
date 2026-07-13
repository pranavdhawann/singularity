import { describe, expect, it } from "vitest";
import { createServer } from "../server/create-server";

describe("context pack routes", () => {
  it("redacts sensitive prompt preview text", async () => {
    const server = await createServer({ databasePath: ":memory:" });
    const workspaceResponse = await server.inject({
      method: "POST",
      url: "/api/workspaces",
      payload: { name: "Redaction Demo" },
    });
    const workspace = workspaceResponse.json<{ id: string }>();

    const previewResponse = await server.inject({
      method: "POST",
      url: "/api/context-packs/preview",
      payload: {
        workspaceId: workspace.id,
        command: "Use token sk-1234567890abcdef",
      },
    });

    await server.close();

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json<{ redactions: Array<{ kind: string }> }>().redactions).toEqual([
      expect.objectContaining({ kind: "secret" }),
    ]);
  });
});
