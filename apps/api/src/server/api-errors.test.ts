import { describe, expect, it } from "vitest";
import { createServer } from "./create-server";

describe("V2 API errors", () => {
  it("wraps schema failures in the stable envelope", async () => {
    const server = await createServer({ databasePath: ":memory:" });
    const response = await server.inject({
      method: "POST",
      url: "/api/workspaces",
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: expect.objectContaining({
        code: "validation_error",
        requestId: expect.any(String)
      })
    });

    await server.close();
  });
});
