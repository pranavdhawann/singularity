import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerApiErrorHandler } from "./api-errors";
import { registerLocalSession } from "./local-session";

const allowedOrigins = ["http://127.0.0.1:4173"];

async function createTestServer() {
  const server = Fastify();
  registerApiErrorHandler(server);
  await registerLocalSession(server, "test-token", allowedOrigins);
  server.post("/api/v2/test-mutation", async () => ({ ok: true }));
  return server;
}

describe("local V2 session", () => {
  it("rejects V2 mutations without the session token", async () => {
    const server = await createTestServer();
    const response = await server.inject({ method: "POST", url: "/api/v2/test-mutation" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: expect.objectContaining({ code: "unauthorized" })
    });

    await server.close();
  });

  it("returns the startup token from the same-origin session endpoint", async () => {
    const server = await createTestServer();
    const response = await server.inject({ method: "GET", url: "/api/v2/session" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ token: "test-token" });

    await server.close();
  });

  it("rejects a mutation from an unrelated browser origin", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/v2/test-mutation",
      headers: {
        origin: "https://unrelated.example",
        "x-future-session": "test-token"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: expect.objectContaining({ code: "forbidden" })
    });

    await server.close();
  });

  it("allows an authorized same-origin mutation", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/v2/test-mutation",
      headers: {
        origin: allowedOrigins[0],
        "x-future-session": "test-token"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await server.close();
  });
});
