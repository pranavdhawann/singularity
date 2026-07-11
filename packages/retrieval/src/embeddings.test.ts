import { describe, expect, it } from "vitest";
import { NoopEmbeddingAdapter } from "./embeddings";

describe("NoopEmbeddingAdapter", () => {
  it("reports vector retrieval unavailable without failing", async () => {
    await expect(new NoopEmbeddingAdapter().embed({ model: "none", texts: ["hello"] }))
      .resolves.toEqual({ available: false, vectors: [] });
  });
});
