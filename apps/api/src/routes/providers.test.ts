import { describe, expect, it } from "vitest";
import { createServer } from "../server/create-server";

describe("provider routes", () => {
  it("rejects unsupported provider kinds", async () => {
    const server = await createServer({ databasePath: ":memory:" });

    const response = await server.inject({
      method: "POST",
      url: "/api/providers",
      payload: {
        kind: "custom-shell",
        displayName: "Unsafe provider"
      }
    });

    await server.close();

    expect(response.statusCode).toBe(400);
  });
});
