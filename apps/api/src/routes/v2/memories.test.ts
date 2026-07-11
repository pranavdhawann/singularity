import { describe, expect, it } from "vitest";
import { createServer } from "../../server/create-server";

const headers = { "x-future-session": "test-token" };

describe("V2 memory routes", () => {
  it("creates, lists, revises, outdates, and deletes memory with strict protection", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const unauthorized = await server.inject({ method: "POST", url: "/api/v2/memories", payload: {} });
    expect(unauthorized.statusCode).toBe(401);
    const invalid = await server.inject({ method: "POST", url: "/api/v2/memories", headers,
      payload: { workspaceId: "w_1", type: "fact", statement: "Fact", confidence: 1,
        reviewState: "proposed", sourceIds: [], surprise: true } });
    expect(invalid.statusCode).toBe(400);
    const createdResponse = await server.inject({ method: "POST", url: "/api/v2/memories", headers,
      payload: { workspaceId: "w_1", type: "fact", statement: "Use a DB", confidence: 0.8,
        reviewState: "proposed", sourceIds: [] } });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json<{ id: string; version: number }>();
    const revisedResponse = await server.inject({ method: "PATCH", url: `/api/v2/memories/${created.id}`, headers,
      payload: { expectedVersion: 1, statement: "Use SQLite", reviewState: "approved", pinned: true, reason: "user_edit" } });
    expect(revisedResponse.statusCode).toBe(200);
    const revised = revisedResponse.json<{ version: number }>();
    const stale = await server.inject({ method: "PATCH", url: `/api/v2/memories/${created.id}`, headers,
      payload: { expectedVersion: 1, pinned: false, reason: "stale" } });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ error: expect.objectContaining({ code: "conflict", details: { expectedVersion: 1, actualVersion: 2 } }) });
    const list = await server.inject({ method: "GET", url: "/api/v2/memories?workspaceId=w_1&reviewState=approved&limit=1" });
    expect(list.json()).toEqual({ items: [expect.objectContaining({ id: created.id, statement: "Use SQLite" })] });
    const revisions = await server.inject({ method: "GET", url: `/api/v2/memories/${created.id}/revisions` });
    expect(revisions.json<{ revisions: unknown[] }>().revisions).toHaveLength(1);
    const remove = await server.inject({ method: "DELETE", url: `/api/v2/memories/${created.id}`, headers,
      payload: { expectedVersion: revised.version } });
    expect(remove.statusCode).toBe(200);
    expect((await server.inject({ method: "GET", url: `/api/v2/memories/${created.id}` })).statusCode).toBe(404);
    const tombstone = await server.inject({ method: "GET", url: `/api/v2/memories/${created.id}?includeDeleted=true` });
    expect(tombstone.json()).toEqual(expect.objectContaining({ id: created.id, deletedAt: expect.any(String) }));
    const deletedRevisions = await server.inject({ method: "GET", url: `/api/v2/memories/${created.id}/revisions` });
    expect(deletedRevisions.json<{ revisions: unknown[] }>().revisions).toHaveLength(2);
    await server.close();
  });
});
