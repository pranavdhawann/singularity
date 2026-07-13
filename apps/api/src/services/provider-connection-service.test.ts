import type { TestProviderConnectionInput } from "@future/core";
import { describe, expect, it, vi } from "vitest";
import { ProviderConnectionService } from "./provider-connection-service";

const input: TestProviderConnectionInput = {
  kind: "openai-compatible",
  baseUrl: "https://models.example/v1/",
  secretEnvironmentVariable: "FUTURE_TEST_KEY",
};

const missingKey = {
  status: "missing_key",
  message: "Set the configured environment variable and restart Singularity.",
} as const;

const unsupported = {
  status: "unsupported",
  message: "The endpoint did not return an OpenAI-compatible model list.",
} as const;

describe("ProviderConnectionService", () => {
  it.each([undefined, ""])("does not fetch when the environment secret is %s", async (secret) => {
    const request = vi.fn<typeof fetch>();
    const service = new ProviderConnectionService({ request, resolveSecret: () => secret });

    await expect(service.test(input)).resolves.toEqual(missingKey);
    expect(request).not.toHaveBeenCalled();
  });

  it("returns only unique model ids for a valid response", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: [{ id: "model-a" }, { id: "model-a" }, { id: "model-b" }] }));
    const service = new ProviderConnectionService({ request, resolveSecret: () => "secret" });

    await expect(service.test(input)).resolves.toEqual({ status: "ok", models: ["model-a", "model-b"] });
    expect(request).toHaveBeenCalledWith(
      "https://models.example/v1/models",
      expect.objectContaining({ method: "GET", headers: { authorization: "Bearer secret" } }),
    );
  });

  it("classifies invalid and unreachable endpoints without exposing network details", async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("raw-network-marker"));
    const service = new ProviderConnectionService({ request, resolveSecret: () => "secret" });

    await expect(service.test({ ...input, baseUrl: "not a url" })).resolves.toEqual({
      status: "unreachable",
      message: "Enter a valid HTTP or HTTPS provider base URL.",
    });
    const result = await service.test(input);
    expect(result).toEqual({
      status: "unreachable",
      message: "Singularity could not reach the provider endpoint.",
    });
    expect(JSON.stringify(result)).not.toContain("raw-network-marker");
  });

  it.each([401, 403])("classifies HTTP %i as a missing or invalid key", async (status) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("raw-auth-marker", { status }));
    const service = new ProviderConnectionService({ request, resolveSecret: () => "secret" });

    const result = await service.test(input);
    expect(result).toEqual(missingKey);
    expect(JSON.stringify(result)).not.toContain("raw-auth-marker");
  });

  it("classifies other unsuccessful responses without exposing their bodies", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("raw-provider-marker", { status: 500 }));
    const service = new ProviderConnectionService({ request, resolveSecret: () => "secret" });

    const result = await service.test(input);
    expect(result).toEqual(unsupported);
    expect(JSON.stringify(result)).not.toContain("raw-provider-marker");
  });

  it.each([
    new Response("not-json", { status: 200 }),
    Response.json({ models: [{ id: "model-a" }] }),
    Response.json({ data: [] }),
    Response.json({ data: [{ id: "" }] }),
  ])("classifies malformed success responses as unsupported", async (response) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response);
    const service = new ProviderConnectionService({ request, resolveSecret: () => "secret" });

    await expect(service.test(input)).resolves.toEqual(unsupported);
  });
});
