import { createEvent } from "@future/core";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../test-db";
import { EventRepository } from "./events";
import { MemoryRepository } from "./memories";
import { SearchRepository } from "./search";

describe("SearchRepository", () => {
  it("searches active workspace documents, memories, and text events", () => {
    const db = createTestDb();
    try {
      db.client.prepare(`INSERT INTO documents VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, ?)`).run(
        "doc_1", "w_1", "Architecture", "memory://doc_1", "text/plain", "doc_hash", "2026-07-11T00:00:00.000Z"
      );
      db.client.prepare(`INSERT INTO document_chunks VALUES (?, ?, ?, ?, ?, NULL, 'pending', ?)`).run(
        "chunk_1", "doc_1", 0, "SQLite stores local documents", 4, "2026-07-11T00:00:00.000Z"
      );
      db.client.prepare(`INSERT INTO document_chunks_fts VALUES (?, ?, ?)`).run(
        "chunk_1", "Architecture", "SQLite stores local documents"
      );
      const memories = new MemoryRepository(db.client);
      memories.create({ workspaceId: "w_1", type: "decision", statement: "SQLite is the source of truth",
        confidence: 0.9, reviewState: "approved", sourceIds: [] });
      memories.create({ workspaceId: "w_1", type: "fact", statement: "SQLite proposal",
        confidence: 1, reviewState: "proposed", sourceIds: [] });
      memories.create({ workspaceId: "w_2", type: "fact", statement: "SQLite elsewhere",
        confidence: 1, reviewState: "approved", sourceIds: [] });
      const events = new EventRepository(db.client);
      events.append(createEvent({ workspaceId: "w_1", type: "user.message.created", actor: "user",
        title: "Message", payload: { text: "Remember the SQLite decision" }, privacy: { labels: ["local"] } }));

      const results = new SearchRepository(db.client).search({ workspaceId: "w_1", query: "SQLite", limit: 10 });
      expect(new Set(results.map((result) => result.kind))).toEqual(
        new Set(["document_chunk", "memory", "timeline_event"])
      );
      expect(results.every((result) => result.workspaceId === "w_1")).toBe(true);
      expect(results.some((result) => result.text.includes("proposal"))).toBe(false);
      expect(results.every((result) => result.contentHash.length === 64)).toBe(true);
      const authorized = new SearchRepository(db.client).listAuthorized("w_1");
      expect(new Set(authorized.map((result) => result.kind))).toEqual(
        new Set(["document_chunk", "memory", "timeline_event"])
      );
      expect(authorized.some((result) => result.text.includes("proposal"))).toBe(false);
      expect(authorized.every((result) => result.workspaceId === "w_1")).toBe(true);
    } finally { db.close(); }
  });

  it("returns empty for punctuation and stable ordering for ties", () => {
    const db = createTestDb();
    try {
      const memories = new MemoryRepository(db.client);
      memories.create({ workspaceId: "w_1", type: "fact", statement: "same token", confidence: 1, reviewState: "approved", sourceIds: [] });
      memories.create({ workspaceId: "w_1", type: "fact", statement: "same token", confidence: 1, reviewState: "approved", sourceIds: [] });
      const search = new SearchRepository(db.client);
      expect(search.search({ workspaceId: "w_1", query: "!!!" })).toEqual([]);
      expect(search.search({ workspaceId: "w_1", query: "same" }).map((item) => item.id))
        .toEqual(search.search({ workspaceId: "w_1", query: "same" }).map((item) => item.id));
    } finally { db.close(); }
  });
});
