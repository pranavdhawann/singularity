import { describe, expect, it } from "vitest";
import { createServer } from "../../server/create-server";

describe("V2 context pack routes", () => {
  it("returns the stable not-found envelope for an unknown pack", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const response = await server.inject({ method: "GET", url: "/api/v2/context-packs/ctx_missing" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: expect.objectContaining({ code: "not_found" }) });
    await server.close();
  });
});
