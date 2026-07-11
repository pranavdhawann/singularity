import { createHash } from "node:crypto";
import {
  createId,
  type CreateMemoryInput,
  type MemoryDto,
  type MemoryListInput,
  type MemoryMutationInput,
  type MemoryRevisionDto,
  type MemoryReviewState,
  type MemoryType
} from "@future/core";
import type { SqliteDatabase } from "../connection";

export type CreateMemoryRecordInput = CreateMemoryInput;

interface MemoryRow {
  id: string; workspace_id: string; type: MemoryType; statement: string; confidence: number;
  review_state: MemoryReviewState; pinned: 0 | 1; version: number;
  outdated_at: string | null; deleted_at: string | null; created_at: string; updated_at: string;
  content_hash: string;
}
interface MembershipRow { namespace_id: string; is_primary: 0 | 1 }
interface SourceRow { source_id: string }
interface RevisionRow { id: string; memory_id: string; previous_json: string; next_json: string; reason: string; created_at: string }

export class MemoryConflictError extends Error {
  constructor(readonly expectedVersion: number, readonly actualVersion: number) {
    super("memory version conflict"); this.name = "MemoryConflictError";
  }
}

export class MemoryRepository {
  constructor(private readonly db: SqliteDatabase) {}

  create(input: CreateMemoryRecordInput, appendEvent: (memory: MemoryDto) => void = () => {}): MemoryDto {
    const id = createId("mem");
    const now = new Date().toISOString();
    const insert = this.db.transaction(() => {
      this.db.prepare(
        `INSERT INTO memories (
          id, workspace_id, type, statement, summary, confidence, scope_json, privacy_json,
          review_state, pinned, outdated_at, last_confirmed_at, created_at, updated_at,
          version, deleted_at, content_hash
        ) VALUES (
          @id, @workspaceId, @type, @statement, NULL, @confidence, '{}', '{}',
          @reviewState, 0, NULL, NULL, @now, @now, 1, NULL, @contentHash
        )`
      ).run({ ...input, id, now, contentHash: hash(input.statement) });
      const source = this.db.prepare(
        `INSERT INTO memory_sources (memory_id, source_type, source_id, range_json)
         VALUES (@memoryId, 'timeline_event', @sourceId, NULL)`
      );
      for (const sourceId of input.sourceIds) source.run({ memoryId: id, sourceId });
      appendEvent(this.get(id)!);
    });
    insert();
    return this.get(id)!;
  }

  get(id: string, options: { includeDeleted?: boolean } = {}): MemoryDto | undefined {
    const row = this.db.prepare<{ id: string }, MemoryRow>(
      `SELECT * FROM memories WHERE id = @id ${options.includeDeleted ? "" : "AND deleted_at IS NULL"}`
    ).get({ id });
    return row ? this.map(row) : undefined;
  }

  list(input: MemoryListInput): { items: MemoryDto[]; nextCursor?: string } {
    const where = ["m.workspace_id = @workspaceId", "m.deleted_at IS NULL"];
    const params: Record<string, string | number> = { workspaceId: input.workspaceId, limit: (input.limit ?? 50) + 1 };
    if (input.reviewState) { where.push("m.review_state = @reviewState"); params.reviewState = input.reviewState; }
    if (input.namespaceId) {
      where.push(`EXISTS (SELECT 1 FROM memory_namespace_memberships mm
        WHERE mm.memory_id = m.id AND mm.namespace_id = @namespaceId)`);
      params.namespaceId = input.namespaceId;
    }
    if (input.cursor) {
      const cursor = decodeCursor(input.cursor);
      where.push("(m.updated_at < @cursorUpdatedAt OR (m.updated_at = @cursorUpdatedAt AND m.id < @cursorId))");
      params.cursorUpdatedAt = cursor.updatedAt; params.cursorId = cursor.id;
    }
    const rows = this.db.prepare<Record<string, string | number>, MemoryRow>(
      `SELECT m.* FROM memories m WHERE ${where.join(" AND ")}
       ORDER BY m.updated_at DESC, m.id DESC LIMIT @limit`
    ).all(params);
    const limit = input.limit ?? 50;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => this.map(row)),
      ...(rows.length > limit && last ? { nextCursor: encodeCursor(last.updated_at, last.id) } : {})
    };
  }

  mutate(id: string, input: MemoryMutationInput, appendEvent: (memory: MemoryDto) => void = () => {}): MemoryDto {
    return this.db.transaction(() => {
      const current = this.get(id, { includeDeleted: true });
      if (!current) throw new Error(`memory not found: ${id}`);
      if (current.version !== input.expectedVersion) throw new MemoryConflictError(input.expectedVersion, current.version);
      const statement = input.statement?.trim() ?? current.statement;
      const reviewState = input.reviewState ?? current.reviewState;
      const pinned = input.pinned ?? current.pinned;
      const now = new Date().toISOString();
      const outdatedAt = reviewState === "outdated" ? (current.outdatedAt ?? now) : null;
      this.validateNamespaces(current.workspaceId, input.namespaceIds, input.primaryNamespaceId);
      const nextVersion = current.version + 1;
      this.db.prepare(
        `UPDATE memories SET statement = @statement, review_state = @reviewState,
         pinned = @pinned, outdated_at = @outdatedAt, updated_at = @now,
         version = @version, content_hash = @contentHash WHERE id = @id`
      ).run({ id, statement, reviewState, pinned: pinned ? 1 : 0, outdatedAt, now,
        version: nextVersion, contentHash: hash(statement) });
      if (input.namespaceIds) this.replaceMemberships(id, input.namespaceIds, input.primaryNamespaceId ?? null, now);
      const next = this.get(id, { includeDeleted: true })!;
      this.insertRevision(id, current, next, input.reason, now);
      appendEvent(next);
      return next;
    })();
  }

  delete(id: string, expectedVersion: number, appendEvent: (memory: MemoryDto) => void = () => {}): MemoryDto {
    return this.db.transaction(() => {
      const current = this.get(id, { includeDeleted: true });
      if (!current) throw new Error(`memory not found: ${id}`);
      if (current.version !== expectedVersion) throw new MemoryConflictError(expectedVersion, current.version);
      const now = new Date().toISOString();
      this.db.prepare(
        `UPDATE memories SET deleted_at = @now, updated_at = @now, version = version + 1 WHERE id = @id`
      ).run({ id, now });
      const next = this.get(id, { includeDeleted: true })!;
      this.insertRevision(id, current, next, "user_delete", now);
      appendEvent(next);
      return next;
    })();
  }

  listRevisions(memoryId: string): MemoryRevisionDto[] {
    return this.db.prepare<{ memoryId: string }, RevisionRow>(
      `SELECT * FROM memory_revisions WHERE memory_id = @memoryId ORDER BY created_at DESC, id DESC`
    ).all({ memoryId }).map((row) => {
      const next = JSON.parse(row.next_json) as Record<string, unknown>;
      return { id: row.id, memoryId: row.memory_id, version: Number(next.version),
        previous: JSON.parse(row.previous_json) as Record<string, unknown>, next,
        reason: row.reason, createdAt: row.created_at };
    });
  }

  private map(row: MemoryRow): MemoryDto {
    const memberships = this.db.prepare<{ id: string }, MembershipRow>(
      `SELECT namespace_id, is_primary FROM memory_namespace_memberships WHERE memory_id = @id ORDER BY namespace_id`
    ).all({ id: row.id });
    const sourceIds = this.db.prepare<{ id: string }, SourceRow>(
      `SELECT source_id FROM memory_sources WHERE memory_id = @id ORDER BY source_id`
    ).all({ id: row.id }).map((source) => source.source_id);
    const primary = memberships.find((membership) => membership.is_primary === 1)?.namespace_id;
    return { id: row.id, workspaceId: row.workspace_id, type: row.type, statement: row.statement,
      confidence: row.confidence, reviewState: row.review_state, pinned: row.pinned === 1,
      version: row.version, namespaceIds: memberships.map((membership) => membership.namespace_id),
      ...(primary ? { primaryNamespaceId: primary } : {}), sourceIds,
      ...(row.content_hash ? { contentHash: row.content_hash } : {}),
      createdAt: row.created_at, updatedAt: row.updated_at,
      ...(row.outdated_at ? { outdatedAt: row.outdated_at } : {}),
      ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}) };
  }

  private validateNamespaces(workspaceId: string, namespaceIds?: string[], primary?: string | null): void {
    if (!namespaceIds) return;
    if (primary && !namespaceIds.includes(primary)) throw new Error("primary namespace must be assigned");
    const lookup = this.db.prepare<{ id: string }, { workspace_id: string }>(
      "SELECT workspace_id FROM memory_namespaces WHERE id = @id"
    );
    for (const id of new Set(namespaceIds)) {
      if (lookup.get({ id })?.workspace_id !== workspaceId) throw new Error("namespace must belong to memory workspace");
    }
  }

  private replaceMemberships(memoryId: string, namespaceIds: string[], primary: string | null, now: string): void {
    this.db.prepare("DELETE FROM memory_namespace_memberships WHERE memory_id = @memoryId").run({ memoryId });
    const insert = this.db.prepare(
      `INSERT INTO memory_namespace_memberships (memory_id, namespace_id, is_primary, created_at)
       VALUES (@memoryId, @namespaceId, @isPrimary, @now)`
    );
    for (const namespaceId of new Set(namespaceIds)) {
      insert.run({ memoryId, namespaceId, isPrimary: namespaceId === primary ? 1 : 0, now });
    }
  }

  private insertRevision(memoryId: string, previous: MemoryDto, next: MemoryDto, reason: string, now: string): void {
    this.db.prepare(
      `INSERT INTO memory_revisions (id, memory_id, previous_json, next_json, reason, created_at)
       VALUES (@id, @memoryId, @previous, @next, @reason, @now)`
    ).run({ id: createId("rev"), memoryId, previous: JSON.stringify(previous), next: JSON.stringify(next), reason, now });
  }
}

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function encodeCursor(updatedAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ updatedAt, id })).toString("base64url");
}
function decodeCursor(cursor: string): { updatedAt: string; id: string } {
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { updatedAt: string; id: string };
}
