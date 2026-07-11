import { describe, expect, it } from "vitest";
import type { MemoryCompactionDto, MemoryDto, MemoryNamespaceDto, MemoryRevisionDto } from "./memory";

describe("Phase 3 memory contracts", () => {
  it("represent versioned, namespaced memory with provenance", () => {
    const memory = {
      id: "mem_1", workspaceId: "w_1", type: "decision",
      statement: "Use SQLite for local state", confidence: 0.95,
      reviewState: "approved", pinned: true, version: 2,
      namespaceIds: ["ns_code"], primaryNamespaceId: "ns_code",
      sourceIds: ["evt_1"], createdAt: "2026-07-11T12:00:00.000Z",
      updatedAt: "2026-07-11T12:05:00.000Z"
    } satisfies MemoryDto;
    expect(memory).toMatchObject({ reviewState: "approved", version: 2, namespaceIds: ["ns_code"] });
  });

  it("represents namespaces, revisions, and source-linked compactions", () => {
    const namespace = {
      id: "ns_code", workspaceId: "w_1", name: "Coding", parentId: null,
      createdAt: "2026-07-11T12:00:00.000Z", updatedAt: "2026-07-11T12:00:00.000Z"
    } satisfies MemoryNamespaceDto;
    const revision = {
      id: "rev_1", memoryId: "mem_1", version: 2,
      previous: { statement: "Use a local database" },
      next: { statement: "Use SQLite for local state" }, reason: "user_edit",
      createdAt: "2026-07-11T12:05:00.000Z"
    } satisfies MemoryRevisionDto;
    const compaction = {
      id: "cmp_1", workspaceId: "w_1", summary: "SQLite is the local source of truth.",
      contentHash: "hash_1", sources: [{ kind: "memory", id: "mem_1", contentHash: "hash_mem" }],
      invalidatedAt: null, createdAt: "2026-07-11T12:10:00.000Z"
    } satisfies MemoryCompactionDto;
    expect(namespace.parentId).toBeNull();
    expect(revision.next.statement).toContain("SQLite");
    expect(compaction.sources).toHaveLength(1);
  });
});
