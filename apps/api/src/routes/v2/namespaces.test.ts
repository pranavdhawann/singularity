import { describe, expect, it } from "vitest";
import { createServer } from "../../server/create-server";

const headers = { "x-future-session": "test-token" };

describe("V2 namespace routes", () => {
  it("creates and lists shallow workspace namespaces", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const rootResponse = await server.inject({ method: "POST", url: "/api/v2/namespaces", headers,
      payload: { workspaceId: "w_1", name: "Coding" } });
    expect(rootResponse.statusCode).toBe(201);
    const root = rootResponse.json<{ id: string }>();
    const child = await server.inject({ method: "POST", url: "/api/v2/namespaces", headers,
      payload: { workspaceId: "w_1", name: "Future", parentId: root.id } });
    expect(child.statusCode).toBe(201);
    const list = await server.inject({ method: "GET", url: "/api/v2/namespaces?workspaceId=w_1" });
    expect(list.json<{ namespaces: unknown[] }>().namespaces).toHaveLength(2);
    const invalid = await server.inject({ method: "POST", url: "/api/v2/namespaces", headers,
      payload: { workspaceId: "w_1", name: "Too deep", parentId: child.json<{ id: string }>().id } });
    expect(invalid.statusCode).toBe(409);
    await server.close();
  });
});
