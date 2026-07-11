import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./api-client";

describe("ApiClient local session", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the session once and authenticates V2 mutations", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "test-token" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockImplementation(async () =>
        new Response(
          JSON.stringify({
            id: "w_demo",
            name: "Future Demo",
            kind: "project",
            privacyMode: "standard",
            createdAt: "2026-07-10T00:00:00.000Z",
            updatedAt: "2026-07-10T00:00:00.000Z"
          }),
          { status: 201, headers: { "content-type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetch);

    const client = new ApiClient();
    await client.createWorkspace({ name: "Future Demo", privacyMode: "standard" });
    await client.createWorkspace({ name: "Second", privacyMode: "local_only" });

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/v2/session");
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/v2/workspaces",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-future-session": "test-token" })
      })
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("parses split server-sent assistant frames incrementally", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: started\ndata: {"type":"started","turn":{"id":"turn_1"}}\n\nevent: del'));
        controller.enqueue(encoder.encode('ta\ndata: {"type":"delta","text":"Hello "}\n\nevent: delta\ndata: {"type":"delta","text":"world"}\n\n'));
        controller.enqueue(encoder.encode('event: completed\ndata: {"type":"completed","turn":{"id":"turn_1"},"event":{},"citations":[]}\n\n'));
        controller.close();
      }
    });
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "test-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetch);
    const frames = [];

    for await (const frame of new ApiClient().streamAssistantTurn("turn_1")) frames.push(frame);

    expect(frames.map((frame) => frame.type)).toEqual(["started", "delta", "delta", "completed"]);
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/v2/assistant-turns/turn_1/stream", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "x-future-session": "test-token" })
    }));
  });

  it("uses typed V2 paths for create, cancel, timeline, and context inspection", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "test-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ turn: { id: "turn_1" }, replayed: false }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "turn_1", state: "cancelled" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ events: [], nextCursor: "evt_1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ctx_1", items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const client = new ApiClient();

    await client.createAssistantTurn({ workspaceId: "w_1", modelProfileId: "profile_1", idempotencyKey: "key_1", message: "Hello" });
    await client.cancelAssistantTurn("turn_1");
    await client.listTimeline("w_1", "evt_0");
    await client.getContextPack("ctx_1");

    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      "/api/v2/session",
      "/api/v2/assistant-turns",
      "/api/v2/assistant-turns/turn_1/cancel",
      "/api/v2/timeline?workspaceId=w_1&after=evt_0",
      "/api/v2/context-packs/ctx_1"
    ]);
  });

  it("uses authenticated PATCH and DELETE for optimistic memory mutations", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "test-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "mem_1", version: 2 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "mem_1", version: 3 }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const client = new ApiClient();
    await client.updateMemory("mem_1", { expectedVersion: 1, pinned: true, reason: "user_edit" });
    await client.deleteMemory("mem_1", 2);
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/v2/memories/mem_1", expect.objectContaining({
      method: "PATCH", headers: expect.objectContaining({ "x-future-session": "test-token" })
    }));
    expect(fetch).toHaveBeenNthCalledWith(3, "/api/v2/memories/mem_1", expect.objectContaining({
      method: "DELETE", body: JSON.stringify({ expectedVersion: 2 })
    }));
  });

  it("uploads multipart imports without overriding the browser content type", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "test-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    const client = new ApiClient();
    const file = new File(["# Notes"], "notes.md", { type: "text/markdown" });

    await client.uploadImports("w_1", [file]);

    const init = fetch.mock.calls[1]?.[1] as RequestInit;
    expect(fetch.mock.calls[1]?.[0]).toBe("/api/v2/imports");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).toEqual({ "x-future-session": "test-token" });
    expect((init.headers as Record<string, string>)["content-type"]).toBeUndefined();
  });
});
