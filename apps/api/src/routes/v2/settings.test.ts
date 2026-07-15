import { describe, expect, it } from "vitest";
import { createServer } from "../../server/create-server";

const headers = { "x-future-session": "test-token" };

describe("V2 settings routes", () => {
  it("returns defaults and persists updates through GET/PATCH", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });

    const initial = await server.inject({ method: "GET", url: "/api/v2/settings?workspaceId=w_1" });
    expect(initial.statusCode).toBe(200);
    expect(initial.json()).toEqual({ redactLocalToo: false, autoCapture: true });

    const patched = await server.inject({
      method: "PATCH",
      url: "/api/v2/settings",
      headers,
      payload: { workspaceId: "w_1", autoCapture: false },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toEqual({ redactLocalToo: false, autoCapture: false });

    const after = await server.inject({ method: "GET", url: "/api/v2/settings?workspaceId=w_1" });
    expect(after.json()).toEqual({ redactLocalToo: false, autoCapture: false });

    const other = await server.inject({ method: "GET", url: "/api/v2/settings?workspaceId=w_2" });
    expect(other.json()).toEqual({ redactLocalToo: false, autoCapture: true });

    await server.close();
  });
});
