import { describe, expect, it, vi } from "vitest";
import { EmbeddingAdapterError } from "./embeddings";
import { OpenAiCompatibleEmbeddingAdapter } from "./openai-embeddings";

describe("OpenAiCompatibleEmbeddingAdapter", () => {
  it("resolves the secret at call time and normalizes indexed vectors", async () => {
    const secret = vi.fn(() => "top-secret-key");
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              { index: 1, embedding: [0, 1] },
              { index: 0, embedding: [1, 0] },
            ],
          }),
          { status: 200 },
        ),
    );
    const adapter = new OpenAiCompatibleEmbeddingAdapter({
      baseUrl: "https://models.example/v1/",
      apiKeyRef: "FUTURE_KEY",
      resolveSecret: secret,
      fetch,
    });
    await expect(adapter.embed({ model: "embed-small", texts: ["a", "b"] })).resolves.toEqual({
      available: true,
      vectors: [
        [1, 0],
        [0, 1],
      ],
    });
    expect(secret).toHaveBeenCalledWith("FUTURE_KEY");
    expect(fetch).toHaveBeenCalledWith(
      "https://models.example/v1/embeddings",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer top-secret-key" }),
      }),
    );
  });

  it("rejects count and dimension mismatches without leaking secrets", async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify({ data: [{ index: 0, embedding: [1] }] }), { status: 200 }),
    );
    const adapter = new OpenAiCompatibleEmbeddingAdapter({
      baseUrl: "https://models.example/v1",
      apiKeyRef: "KEY",
      resolveSecret: () => "never-leak",
      fetch,
    });
    await expect(adapter.embed({ model: "embed", texts: ["a", "b"] })).rejects.toEqual(
      expect.any(EmbeddingAdapterError),
    );
    try {
      await adapter.embed({ model: "embed", texts: ["a", "b"] });
    } catch (error) {
      expect(String(error)).not.toContain("never-leak");
    }
  });

  it("propagates aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      init?.signal?.throwIfAborted();
      return new Response();
    });
    const adapter = new OpenAiCompatibleEmbeddingAdapter({
      baseUrl: "https://models.example/v1",
      apiKeyRef: "KEY",
      resolveSecret: () => "secret",
      fetch,
    });
    await expect(adapter.embed({ model: "embed", texts: ["a"], signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
