import { createId, type CreateNamespaceInput, type MemoryNamespaceDto } from "@future/core";
import type { SqliteDatabase } from "../connection";

interface NamespaceRow {
  id: string; workspace_id: string; name: string; parent_id: string | null;
  created_at: string; updated_at: string;
}

export class NamespaceConflictError extends Error {
  constructor(message: string) { super(message); this.name = "NamespaceConflictError"; }
}

export class NamespaceRepository {
  constructor(private readonly db: SqliteDatabase) {}

  create(input: CreateNamespaceInput): MemoryNamespaceDto {
    const name = input.name.trim();
    if (!name) throw new NamespaceConflictError("namespace name is required");
    const parentId = input.parentId ?? null;
    if (parentId) {
      const parent = this.get(parentId);
      if (!parent || parent.workspaceId !== input.workspaceId || parent.parentId) {
        throw new NamespaceConflictError("namespace parent must be a root in the same workspace");
      }
    }
    const duplicate = this.db.prepare<{ workspaceId: string; parentId: string | null; name: string }, { id: string }>(
      `SELECT id FROM memory_namespaces
       WHERE workspace_id = @workspaceId AND parent_id IS @parentId AND lower(name) = lower(@name)`
    ).get({ workspaceId: input.workspaceId, parentId, name });
    if (duplicate) throw new NamespaceConflictError("namespace already exists");
    const now = new Date().toISOString();
    const id = createId("ns");
    this.db.prepare(
      `INSERT INTO memory_namespaces (id, workspace_id, name, parent_id, created_at, updated_at)
       VALUES (@id, @workspaceId, @name, @parentId, @now, @now)`
    ).run({ id, workspaceId: input.workspaceId, name, parentId, now });
    return this.get(id)!;
  }

  get(id: string): MemoryNamespaceDto | undefined {
    return mapNamespace(this.db.prepare<{ id: string }, NamespaceRow>(
      "SELECT * FROM memory_namespaces WHERE id = @id"
    ).get({ id }));
  }

  list(workspaceId: string): MemoryNamespaceDto[] {
    return this.db.prepare<{ workspaceId: string }, NamespaceRow>(
      `SELECT * FROM memory_namespaces WHERE workspace_id = @workspaceId
       ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, created_at, id`
    ).all({ workspaceId }).map((row) => mapNamespace(row)!);
  }
}

function mapNamespace(row: NamespaceRow | undefined): MemoryNamespaceDto | undefined {
  if (!row) return undefined;
  return { id: row.id, workspaceId: row.workspace_id, name: row.name, parentId: row.parent_id,
    createdAt: row.created_at, updatedAt: row.updated_at };
}
