import { describe, expect, it } from "vitest";
import { createTestDb } from "../test-db";
import { MemoryConflictError, MemoryRepository } from "./memories";
import { NamespaceRepository } from "./namespaces";

describe("MemoryRepository", () => {
  it("creates, filters, revises, and tombstones namespaced memory", () => {
    const db = createTestDb();
    try {
      const namespaces = new NamespaceRepository(db.client);
      const coding = namespaces.create({ workspaceId: "w_1", name: "Coding" });
      const future = namespaces.create({ workspaceId: "w_1", name: "Future", parentId: coding.id });
      const memories = new MemoryRepository(db.client);
      const created = memories.create({
        workspaceId: "w_1", type: "decision", statement: "Use SQLite",
        confidence: 0.9, reviewState: "proposed", sourceIds: ["evt_1"]
      });
      const revised = memories.mutate(created.id, {
        expectedVersion: 1, statement: "Use SQLite for local state",
        reviewState: "approved", pinned: true,
        namespaceIds: [coding.id, future.id], primaryNamespaceId: future.id,
        reason: "user_edit"
      });

      expect(revised).toMatchObject({ version: 2, pinned: true, primaryNamespaceId: future.id });
      expect(memories.list({ workspaceId: "w_1", reviewState: "approved", namespaceId: coding.id }).items)
        .toEqual([revised]);
      expect(memories.listRevisions(created.id)).toHaveLength(1);
      expect(memories.listRevisions(created.id)[0]).toMatchObject({ version: 2, reason: "user_edit" });

      const outdated = memories.mutate(created.id, {
        expectedVersion: 2, reviewState: "outdated", reason: "user_outdated"
      });
      expect(outdated.outdatedAt).toBeTruthy();
      const deleted = memories.delete(created.id, 3);
      expect(deleted.deletedAt).toBeTruthy();
      expect(memories.get(created.id)).toBeUndefined();
      expect(memories.get(created.id, { includeDeleted: true })?.version).toBe(4);
    } finally { db.close(); }
  });

  it("uses stable cursors and rejects stale versions", () => {
    const db = createTestDb();
    try {
      const memories = new MemoryRepository(db.client);
      const first = memories.create({ workspaceId: "w_1", type: "fact", statement: "First", confidence: 1, reviewState: "approved", sourceIds: [] });
      memories.create({ workspaceId: "w_1", type: "fact", statement: "Second", confidence: 1, reviewState: "approved", sourceIds: [] });
      const page1 = memories.list({ workspaceId: "w_1", limit: 1 });
      expect(page1.nextCursor).toBeTruthy();
      const page2 = memories.list({ workspaceId: "w_1", limit: 1, cursor: page1.nextCursor! });
      expect(page1.items).toHaveLength(1);
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
      expect(() => memories.mutate(first.id, { expectedVersion: 9, pinned: true, reason: "stale" }))
        .toThrow(MemoryConflictError);
    } finally { db.close(); }
  });

  it("rolls back the memory mutation when its event callback fails", () => {
    const db = createTestDb();
    try {
      const memories = new MemoryRepository(db.client);
      const memory = memories.create({ workspaceId: "w_1", type: "fact", statement: "Before", confidence: 1, reviewState: "approved", sourceIds: [] });
      expect(() => memories.mutate(memory.id, {
        expectedVersion: 1, statement: "After", reason: "user_edit"
      }, () => { throw new Error("event failed"); })).toThrow("event failed");
      expect(memories.get(memory.id)).toMatchObject({ statement: "Before", version: 1 });
      expect(memories.listRevisions(memory.id)).toEqual([]);
    } finally { db.close(); }
  });
});
