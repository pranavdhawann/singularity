import { describe, expect, it } from "vitest";
import { createTestDb } from "@future/db";
import { indexSearchChunk, searchAllLexical, searchLexical } from "./lexical";

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
        tokenCount: 9,
      });

      const results = searchLexical(db.client, { query: "SQLite local truth" });

      expect(results[0]).toEqual(
        expect.objectContaining({
          chunkId: "chunk_1",
          documentId: "doc_1",
          title: "Future Architecture",
        }),
      );
      expect(results[0]?.snippet).toContain("SQLite");
    } finally {
      db.close();
    }
  });
});

describe("searchAllLexical", () => {
  it("returns normalized unified candidates", () => {
    const db = createTestDb();
    try {
      indexSearchChunk(db.client, {
        chunkId: "chunk_all",
        documentId: "doc_all",
        title: "All",
        text: "hybrid retrieval",
        chunkIndex: 0,
        tokenCount: 2,
        workspaceId: "w_all",
      });
      expect(searchAllLexical(db.client, { workspaceId: "w_all", query: "hybrid" })).toEqual([
        expect.objectContaining({ kind: "document_chunk", id: "chunk_all", lexicalScore: 1 }),
      ]);
    } finally {
      db.close();
    }
  });
});
