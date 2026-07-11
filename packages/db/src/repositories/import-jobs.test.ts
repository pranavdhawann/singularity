import { describe, expect, it } from "vitest";
import { createTestDb } from "../test-db";
import { ImportJobConflictError, ImportJobRepository } from "./import-jobs";

describe("ImportJobRepository", () => {
  it("persists a file and advances checkpoints with compare-and-set transitions", () => {
    const db = createTestDb();
    try {
      const repository = new ImportJobRepository(db.client);
      const created = repository.createFile({
        workspaceId: "w_1",
        filename: "notes.md",
        mediaType: "text/markdown",
        kind: "markdown",
        content: Buffer.from("# Notes\nUse SQLite")
      });

      expect(created.state).toBe("queued");
      expect(repository.readPayload(created.importId).toString()).toContain("Use SQLite");

      const parsing = repository.advance(created.id, "queued", {
        state: "parsing",
        documentCount: 1
      });
      const indexing = repository.advance(created.id, "parsing", {
        state: "indexing",
        documentIndex: 0,
        nextChunkIndex: 1
      });

      expect(parsing.documentCount).toBe(1);
      expect(indexing.nextChunkIndex).toBe(1);
      expect(() => repository.advance(created.id, "queued", { state: "parsing" }))
        .toThrow(ImportJobConflictError);
    } finally {
      db.close();
    }
  });

  it("requeues failed work without discarding its checkpoint", () => {
    const db = createTestDb();
    try {
      const repository = new ImportJobRepository(db.client);
      const created = repository.createFile({
        workspaceId: "w_1",
        filename: "notes.txt",
        mediaType: "text/plain",
        kind: "text",
        content: Buffer.from("one two three")
      });
      repository.advance(created.id, "queued", {
        state: "indexing",
        documentCount: 1,
        nextChunkIndex: 2
      });
      repository.fail(created.id, "index_failed");

      const retried = repository.retry(created.id);

      expect(retried.state).toBe("queued");
      expect(retried.nextChunkIndex).toBe(2);
      expect(retried.errorCode).toBeUndefined();
    } finally {
      db.close();
    }
  });
});
