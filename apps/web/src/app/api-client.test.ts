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
});
