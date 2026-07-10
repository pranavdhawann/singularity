import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../../server/create-server";

const sessionHeaders = { "x-future-session": "test-token" };

describe("V2 assistant turn routes", () => {
  let server: FastifyInstance | undefined;

  afterEach(async () => {
    await server?.close();
  });

  it("creates idempotently, streams SSE, and exposes cited persisted context", async () => {
    const ready = await setupReadyServer();
    server = ready.server;
    const body = {
      workspaceId: ready.workspaceId,
      modelProfileId: ready.modelProfileId,
      idempotencyKey: "browser-key-1",
      message: "Hello Future"
    };

    const created = await server.inject({ method: "POST", url: "/api/v2/assistant-turns", headers: sessionHeaders, payload: body });
    expect(created.statusCode).toBe(201);
    const turn = created.json<{ turn: { id: string } }>().turn;
    const replay = await server.inject({ method: "POST", url: "/api/v2/assistant-turns", headers: sessionHeaders, payload: body });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(expect.objectContaining({ replayed: true }));

    const streamed = await server.inject({ method: "POST", url: `/api/v2/assistant-turns/${turn.id}/stream`, headers: sessionHeaders });
    expect(streamed.statusCode).toBe(200);
    expect(streamed.headers["content-type"]).toContain("text/event-stream");
    expect(streamed.body).toContain("event: delta");
    expect(streamed.body).toContain("event: completed");

    const persisted = await server.inject({ method: "GET", url: `/api/v2/assistant-turns/${turn.id}` });
    expect(persisted.json()).toEqual(expect.objectContaining({ state: "completed", assistantEventId: expect.any(String) }));

    const second = await server.inject({
      method: "POST",
      url: "/api/v2/assistant-turns",
      headers: sessionHeaders,
      payload: { ...body, idempotencyKey: "browser-key-2", message: "What did I just ask?" }
    });
    const secondId = second.json<{ turn: { id: string } }>().turn.id;
    const secondStream = await server.inject({ method: "POST", url: `/api/v2/assistant-turns/${secondId}/stream`, headers: sessionHeaders });
    expect(secondStream.body).toContain("event: completed");
    const secondTurn = (await server.inject({ method: "GET", url: `/api/v2/assistant-turns/${secondId}` })).json<{ contextPackId: string }>();
    const inspection = await server.inject({ method: "GET", url: `/api/v2/context-packs/${secondTurn.contextPackId}` });
    expect(inspection.statusCode).toBe(200);
    expect(inspection.json()).toEqual(expect.objectContaining({
      model: "mock",
      items: expect.arrayContaining([expect.objectContaining({ source: expect.objectContaining({ kind: "timeline_event" }) })])
    }));
    const timeline = await server.inject({ method: "GET", url: `/api/v2/timeline?workspaceId=${ready.workspaceId}` });
    const assistantEvents = timeline.json<{ events: Array<{ type: string; citations: unknown[] }> }>().events
      .filter((event) => event.type === "assistant.response.created");
    expect(assistantEvents.at(-1)?.citations.length).toBeGreaterThan(0);
  });

  it("protects mutations and rejects extra create properties", async () => {
    const ready = await setupReadyServer();
    server = ready.server;
    const payload = {
      workspaceId: ready.workspaceId,
      modelProfileId: ready.modelProfileId,
      idempotencyKey: "browser-key-2",
      message: "Hello",
      unexpected: true
    };

    const unauthorized = await server.inject({ method: "POST", url: "/api/v2/assistant-turns", payload });
    expect(unauthorized.statusCode).toBe(401);
    const invalid = await server.inject({ method: "POST", url: "/api/v2/assistant-turns", headers: sessionHeaders, payload });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ error: expect.objectContaining({ code: "validation_error" }) });
  });

  it("cancels a queued turn and records the terminal state", async () => {
    const ready = await setupReadyServer();
    server = ready.server;
    const created = await server.inject({
      method: "POST",
      url: "/api/v2/assistant-turns",
      headers: sessionHeaders,
      payload: { workspaceId: ready.workspaceId, modelProfileId: ready.modelProfileId, idempotencyKey: "cancel-key", message: "Never mind" }
    });
    const turnId = created.json<{ turn: { id: string } }>().turn.id;

    const cancelled = await server.inject({ method: "POST", url: `/api/v2/assistant-turns/${turnId}/cancel`, headers: sessionHeaders });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toEqual(expect.objectContaining({ state: "cancelled" }));
  });
});

async function setupReadyServer() {
  const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
  const workspace = await server.inject({ method: "POST", url: "/api/v2/workspaces", headers: sessionHeaders, payload: { name: "Assistant", privacyMode: "local_only" } });
  const workspaceId = workspace.json<{ id: string }>().id;
  const provider = await server.inject({ method: "POST", url: "/api/v2/providers", headers: sessionHeaders, payload: { kind: "mock", displayName: "Mock", isLocal: true } });
  const providerId = provider.json<{ id: string }>().id;
  const profile = await server.inject({ method: "POST", url: "/api/v2/model-profiles", headers: sessionHeaders, payload: { providerId, name: "Default", model: "mock", contextWindow: 4096, purpose: "general", privacyPolicy: "local_only" } });
  return { server, workspaceId, modelProfileId: profile.json<{ id: string }>().id };
}
