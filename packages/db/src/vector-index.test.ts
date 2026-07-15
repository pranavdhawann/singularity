import { describe, expect, it } from "vitest";
import { createTestDb } from "./test-db";
import { SqliteVecIndex } from "./vector-index";

describe("SqliteVecIndex", () => {
  it("returns nearest embeddings by cosine, scoped to a workspace, or degrades cleanly", () => {
    const db = createTestDb();
    try {
      const index = SqliteVecIndex.create(db.client);
      index.upsert({ embeddingId: "a", workspaceId: "w1", vector: [1, 0, 0] });
      index.upsert({ embeddingId: "b", workspaceId: "w1", vector: [0, 1, 0] });
      index.upsert({ embeddingId: "c", workspaceId: "w2", vector: [1, 0, 0] });

      const matches = index.search({ workspaceId: "w1", vector: [0.9, 0.1, 0], limit: 2 });

      if (index.available) {
        expect(matches.map((match) => match.embeddingId)).toEqual(["a", "b"]);
        expect(matches.map((match) => match.embeddingId)).not.toContain("c");
      } else {
        // Without the optional native extension every call is a safe no-op.
        expect(matches).toEqual([]);
      }
    } finally {
      db.close();
    }
  });
});
