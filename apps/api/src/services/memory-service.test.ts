import { createHash } from "node:crypto";
import { CompactionRepository, EmbeddingRepository, EventRepository, MemoryRepository, NamespaceRepository, createTestDb } from "@future/db";
import { describe, expect, it } from "vitest";
import { MemoryService, MemoryServiceError } from "./memory-service";

function setup() {
  const db = createTestDb();
  const memories = new MemoryRepository(db.client);
  const namespaces = new NamespaceRepository(db.client);
  const compactions = new CompactionRepository(db.client);
  const embeddings = new EmbeddingRepository(db.client);
  const events = new EventRepository(db.client);
  return { db, memories, namespaces, compactions, embeddings, events,
    service: new MemoryService({ db: db.client, memories, namespaces, compactions, embeddings, events }) };
}

describe("MemoryService", () => {
  it("writes lifecycle events and invalidates stale derived data transactionally", () => {
    const ctx = setup();
    try {
      const memory = ctx.service.create({ workspaceId: "w_1", type: "decision", statement: "Use a DB",
        confidence: 0.8, reviewState: "proposed", sourceIds: [] });
      const namespace = ctx.service.createNamespace({ workspaceId: "w_1", name: "Coding" });
      const oldHash = createHash("sha256").update(memory.statement).digest("hex");
      ctx.embeddings.upsert({ workspaceId: "w_1", sourceKind: "memory", sourceId: memory.id,
        contentHash: oldHash, adapter: "ollama", model: "embed", vector: [1, 0] });
      ctx.compactions.create({ workspaceId: "w_1", summary: "Old summary",
        sources: [{ kind: "memory", id: memory.id, contentHash: oldHash }] });

      const revised = ctx.service.mutate(memory.id, { expectedVersion: 1,
        statement: "Use SQLite", reviewState: "approved", pinned: true,
        namespaceIds: [namespace.id], primaryNamespaceId: namespace.id, reason: "user_edit" });
      expect(revised.version).toBe(2);
      expect(ctx.events.list({ workspaceId: "w_1", order: "asc" }).map((event) => event.type)).toEqual(
        expect.arrayContaining(["memory.proposed", "memory.namespace.created", "memory.revised",
          "memory.approved", "memory.pinned", "memory.namespace.assigned"])
      );
      expect(ctx.events.list({ workspaceId: "w_1" })).toHaveLength(6);
      expect(ctx.embeddings.listForSources({ workspaceId: "w_1", adapter: "ollama", model: "embed",
        sources: [{ kind: "memory", id: memory.id, contentHash: oldHash }] })).toEqual([]);
      expect(ctx.compactions.activeSourceKeys("w_1")).toEqual([]);

      const outdated = ctx.service.mutate(memory.id, { expectedVersion: 2, reviewState: "outdated", reason: "stale" });
      ctx.service.delete(memory.id, outdated.version);
      expect(ctx.events.list({ workspaceId: "w_1" }).map((event) => event.type))
        .toEqual(expect.arrayContaining(["memory.outdated", "memory.deleted"]));
    } finally { ctx.db.close(); }
  });

  it("creates source-linked compactions and maps version conflicts", () => {
    const ctx = setup();
    try {
      const memory = ctx.service.create({ workspaceId: "w_1", type: "fact", statement: "Local fact",
        confidence: 1, reviewState: "approved", sourceIds: [] });
      const hash = createHash("sha256").update(memory.statement).digest("hex");
      const compaction = ctx.service.createCompaction({ workspaceId: "w_1", summary: "Local summary",
        sources: [{ kind: "memory", id: memory.id, contentHash: hash }] });
      expect(compaction.sources).toHaveLength(1);
      expect(ctx.events.list({ workspaceId: "w_1" })[0]?.type).toBe("memory.compacted");
      expect(() => ctx.service.mutate(memory.id, { expectedVersion: 99, pinned: true, reason: "stale" }))
        .toThrow(MemoryServiceError);
      try { ctx.service.mutate(memory.id, { expectedVersion: 99, pinned: true, reason: "stale" }); }
      catch (error) { expect(error).toMatchObject({ code: "conflict", details: { expectedVersion: 99, actualVersion: 1 } }); }
    } finally { ctx.db.close(); }
  });
});
