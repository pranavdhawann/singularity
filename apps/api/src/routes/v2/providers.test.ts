import { describe, expect, it } from "vitest";
import { createServer } from "../../server/create-server";

const sessionHeaders = { "x-future-session": "test-token" };

describe("V2 provider routes", () => {
  it("requires the local session for connection tests", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const response = await server.inject({
      method: "POST",
      url: "/api/v2/providers/connection-test",
      payload: {
        kind: "openai-compatible",
        baseUrl: "https://models.example/v1",
        secretEnvironmentVariable: "FUTURE_MISSING_CONNECTION_KEY",
      },
    });

    expect(response.statusCode).toBe(401);
    await server.close();
  });

  it("returns a safe missing-key result without persisting a provider", async () => {
    const previous = process.env.FUTURE_MISSING_CONNECTION_KEY;
    delete process.env.FUTURE_MISSING_CONNECTION_KEY;
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/v2/providers/connection-test",
        headers: sessionHeaders,
        payload: {
          kind: "openai-compatible",
          baseUrl: "https://models.example/v1",
          secretEnvironmentVariable: "FUTURE_MISSING_CONNECTION_KEY",
        },
      });
      const providers = await server.inject({ method: "GET", url: "/api/v2/providers" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: "missing_key",
        message: "Set the configured environment variable and restart Singularity.",
      });
      expect(providers.json()).toEqual({ providers: [] });
    } finally {
      if (previous === undefined) delete process.env.FUTURE_MISSING_CONNECTION_KEY;
      else process.env.FUTURE_MISSING_CONNECTION_KEY = previous;
      await server.close();
    }
  });

  it("creates and lists a provider with its model profile", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const providerResponse = await server.inject({
      method: "POST",
      url: "/api/v2/providers",
      headers: sessionHeaders,
      payload: {
        kind: "ollama",
        displayName: "Local Ollama",
        baseUrl: "http://127.0.0.1:11434",
        isLocal: true,
      },
    });
    const provider = providerResponse.json<{ id: string }>();
    const profileResponse = await server.inject({
      method: "POST",
      url: "/api/v2/model-profiles",
      headers: sessionHeaders,
      payload: {
        providerId: provider.id,
        name: "Local default",
        model: "qwen3:8b",
        contextWindow: 32768,
        purpose: "general",
        privacyPolicy: "local_only",
      },
    });
    const providersResponse = await server.inject({ method: "GET", url: "/api/v2/providers" });
    const profilesResponse = await server.inject({
      method: "GET",
      url: `/api/v2/model-profiles?providerId=${provider.id}`,
    });

    expect(providerResponse.statusCode).toBe(201);
    expect(providerResponse.json()).toEqual(expect.objectContaining({ hasSecret: false, displayName: "Local Ollama" }));
    expect(providerResponse.json()).not.toHaveProperty("apiKeyRef");
    expect(profileResponse.statusCode).toBe(201);
    expect(providersResponse.json()).toEqual({ providers: [expect.objectContaining({ id: provider.id })] });
    expect(profilesResponse.json()).toEqual({
      modelProfiles: [expect.objectContaining({ providerId: provider.id, model: "qwen3:8b" })],
    });

    await server.close();
  });

  it("rejects a model profile for an unknown provider", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const response = await server.inject({
      method: "POST",
      url: "/api/v2/model-profiles",
      headers: sessionHeaders,
      payload: {
        providerId: "prov_missing",
        name: "Missing",
        model: "missing",
        contextWindow: 4096,
        purpose: "general",
        privacyPolicy: "prompt_preview",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: expect.objectContaining({ code: "not_found" }) });
    await server.close();
  });

  it("reports the applied migration count from V2 health", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const response = await server.inject({ method: "GET", url: "/api/v2/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, apiVersion: "v2", database: { migrationCount: 4 } });
    await server.close();
  });
});
