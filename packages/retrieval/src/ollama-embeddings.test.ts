import { describe, expect, it, vi } from "vitest";
import { EmbeddingAdapterError } from "./embeddings";
import { OllamaEmbeddingAdapter } from "./ollama-embeddings";

describe("OllamaEmbeddingAdapter", () => {
  it("posts ordered inputs to the local embed endpoint", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ embeddings: [[1, 0], [0, 1]] }), { status: 200 }));
    const adapter = new OllamaEmbeddingAdapter({ baseUrl: "http://127.0.0.1:11434/", fetch });
    await expect(adapter.embed({ model: "nomic-embed-text", texts: ["a", "b"] })).resolves.toEqual({
      available: true, vectors: [[1, 0], [0, 1]]
    });
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:11434/api/embed", expect.objectContaining({
      method: "POST", body: JSON.stringify({ model: "nomic-embed-text", input: ["a", "b"] })
    }));
  });

  it("returns safe typed errors for invalid provider responses", async () => {
    const fetch = vi.fn(async () => new Response("secret provider body", { status: 500 }));
    await expect(new OllamaEmbeddingAdapter({ baseUrl: "http://localhost:11434", fetch })
      .embed({ model: "embed", texts: ["a"] })).rejects.toEqual(expect.any(EmbeddingAdapterError));
    try { await new OllamaEmbeddingAdapter({ baseUrl: "http://localhost:11434", fetch })
      .embed({ model: "embed", texts: ["a"] }); } catch (error) {
      expect(String(error)).not.toContain("secret provider body");
    }
  });
});
