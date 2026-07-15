import { describe, expect, it } from "vitest";
import { createTestDb } from "../test-db";
import { EmbeddingDimensionError, EmbeddingRepository } from "./embeddings";

describe("EmbeddingRepository", () => {
  it("round trips current vectors and isolates workspace, model, and hash", () => {
    const db = createTestDb();
    try {
      const embeddings = new EmbeddingRepository(db.client);
      embeddings.upsert({
        workspaceId: "w_1",
        sourceKind: "memory",
        sourceId: "mem_1",
        contentHash: "hash_1",
        adapter: "ollama",
        model: "embed-a",
        vector: [0.1, 0.2],
      });
      embeddings.upsert({
        workspaceId: "w_2",
        sourceKind: "memory",
        sourceId: "mem_1",
        contentHash: "hash_2",
        adapter: "ollama",
        model: "embed-b",
        vector: [0.3, 0.4],
      });
      expect(
        embeddings.listForSources({
          workspaceId: "w_1",
          adapter: "ollama",
          model: "embed-a",
          sources: [{ kind: "memory", id: "mem_1", contentHash: "hash_1" }],
        }),
      ).toEqual([expect.objectContaining({ workspaceId: "w_1", vector: [0.1, 0.2], dimensions: 2 })]);
      embeddings.invalidateSource("w_1", "memory", "mem_1", "hash_2");
      expect(
        embeddings.listForSources({
          workspaceId: "w_1",
          adapter: "ollama",
          model: "embed-a",
          sources: [{ kind: "memory", id: "mem_1", contentHash: "hash_1" }],
        }),
      ).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("finds the most similar persisted embeddings, scoped to workspace, adapter, and model", () => {
    const db = createTestDb();
    try {
      const embeddings = new EmbeddingRepository(db.client);
      const store = (id: string, vector: number[], workspaceId = "w_1", model = "e") =>
        embeddings.upsert({
          workspaceId,
          sourceKind: "document_chunk",
          sourceId: id,
          contentHash: id,
          adapter: "ollama",
          model,
          vector,
        });
      store("near", [1, 0, 0]);
      store("mid", [0.5, 0.5, 0]);
      store("far", [0, 0, 1]);
      store("other_ws", [1, 0, 0], "w_2");
      store("other_model", [1, 0, 0], "w_1", "different");

      const results = embeddings.searchSimilar({
        workspaceId: "w_1",
        adapter: "ollama",
        model: "e",
        queryVector: [0.9, 0.1, 0],
        limit: 2,
      });

      expect(results.map((record) => record.sourceId)).toEqual(["near", "mid"]);
      expect(results.map((record) => record.sourceId)).not.toContain("far");
      expect(results.map((record) => record.sourceId)).not.toContain("other_ws");
      expect(results.map((record) => record.sourceId)).not.toContain("other_model");
    } finally {
      db.close();
    }
  });

  it("rejects non-finite and inconsistent vector dimensions", () => {
    const db = createTestDb();
    try {
      const embeddings = new EmbeddingRepository(db.client);
      expect(() =>
        embeddings.upsert({
          workspaceId: "w_1",
          sourceKind: "memory",
          sourceId: "m1",
          contentHash: "h1",
          adapter: "ollama",
          model: "e",
          vector: [1, Number.NaN],
        }),
      ).toThrow(EmbeddingDimensionError);
      embeddings.upsert({
        workspaceId: "w_1",
        sourceKind: "memory",
        sourceId: "m1",
        contentHash: "h1",
        adapter: "ollama",
        model: "e",
        vector: [1, 2],
      });
      expect(() =>
        embeddings.upsert({
          workspaceId: "w_1",
          sourceKind: "memory",
          sourceId: "m2",
          contentHash: "h2",
          adapter: "ollama",
          model: "e",
          vector: [1, 2, 3],
        }),
      ).toThrow(EmbeddingDimensionError);
    } finally {
      db.close();
    }
  });
});
