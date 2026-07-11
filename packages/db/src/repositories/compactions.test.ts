import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../test-db";
import { CompactionConflictError, CompactionRepository } from "./compactions";
import { MemoryRepository } from "./memories";

describe("CompactionRepository", () => {
  it("stores ordered source provenance and returns active suppression keys", () => {
    const db = createTestDb();
    try {
      const memory = new MemoryRepository(db.client).create({ workspaceId: "w_1", type: "summary",
        statement: "Older decision", confidence: 1, reviewState: "approved", sourceIds: [] });
      const contentHash = createHash("sha256").update(memory.statement).digest("hex");
      const compactions = new CompactionRepository(db.client);
      const created = compactions.create({ workspaceId: "w_1", summary: "Current decision",
        sources: [{ kind: "memory", id: memory.id, contentHash }] });
      expect(created.sources).toEqual([{ kind: "memory", id: memory.id, contentHash }]);
      expect(compactions.activeSourceKeys("w_1")).toEqual([`memory:${memory.id}:${contentHash}`]);
      compactions.invalidateForSource("memory", memory.id);
      expect(compactions.activeSourceKeys("w_1")).toEqual([]);
      expect(compactions.get(created.id)?.invalidatedAt).toBeTruthy();
    } finally { db.close(); }
  });

  it("rejects empty, missing, and cross-workspace sources", () => {
    const db = createTestDb();
    try {
      const compactions = new CompactionRepository(db.client);
      expect(() => compactions.create({ workspaceId: "w_1", summary: "Empty", sources: [] }))
        .toThrow(CompactionConflictError);
      expect(() => compactions.create({ workspaceId: "w_1", summary: "Missing",
        sources: [{ kind: "memory", id: "missing", contentHash: "hash" }] }))
        .toThrow(CompactionConflictError);
      const memory = new MemoryRepository(db.client).create({ workspaceId: "w_2", type: "fact",
        statement: "Other", confidence: 1, reviewState: "approved", sourceIds: [] });
      const hash = createHash("sha256").update(memory.statement).digest("hex");
      expect(() => compactions.create({ workspaceId: "w_1", summary: "Wrong workspace",
        sources: [{ kind: "memory", id: memory.id, contentHash: hash }] }))
        .toThrow(CompactionConflictError);
    } finally { db.close(); }
  });
});
