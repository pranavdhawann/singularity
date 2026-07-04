import { describe, expect, it } from "vitest";
import { createTestDb } from "@future/db";
import { indexSearchChunk, searchLexical } from "./lexical";

describe("searchLexical", () => {
  it("returns matching chunks with title and snippet", () => {
    const db = createTestDb();

    try {
      indexSearchChunk(db.client, {
        chunkId: "chunk_1",
        documentId: "doc_1",
        title: "Future Architecture",
        text: "Future uses SQLite as the local source of truth.",
        chunkIndex: 0,
        tokenCount: 9
      });

      const results = searchLexical(db.client, { query: "SQLite local truth" });

      expect(results[0]).toEqual(
        expect.objectContaining({
          chunkId: "chunk_1",
          documentId: "doc_1",
          title: "Future Architecture"
        })
      );
      expect(results[0]?.snippet).toContain("SQLite");
    } finally {
      db.close();
    }
  });
});
