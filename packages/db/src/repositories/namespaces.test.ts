import { describe, expect, it } from "vitest";
import { createTestDb } from "../test-db";
import { NamespaceConflictError, NamespaceRepository } from "./namespaces";

describe("NamespaceRepository", () => {
  it("creates and lists a root with one child level", () => {
    const db = createTestDb();
    try {
      const namespaces = new NamespaceRepository(db.client);
      const root = namespaces.create({ workspaceId: "w_1", name: "Coding" });
      const child = namespaces.create({ workspaceId: "w_1", name: "Future", parentId: root.id });
      expect(namespaces.list("w_1")).toEqual([root, child]);
      expect(namespaces.get(child.id)).toEqual(child);
      expect(() => namespaces.create({ workspaceId: "w_1", name: "API", parentId: child.id }))
        .toThrow(NamespaceConflictError);
    } finally { db.close(); }
  });

  it("rejects duplicate siblings and cross-workspace parents", () => {
    const db = createTestDb();
    try {
      const namespaces = new NamespaceRepository(db.client);
      const root = namespaces.create({ workspaceId: "w_1", name: "Coding" });
      expect(() => namespaces.create({ workspaceId: "w_1", name: "Coding" }))
        .toThrow(NamespaceConflictError);
      expect(() => namespaces.create({ workspaceId: "w_2", name: "Other", parentId: root.id }))
        .toThrow(NamespaceConflictError);
    } finally { db.close(); }
  });
});
