import { createHash } from "node:crypto";
import { createId, type CreateCompactionInput, type MemoryCompactionDto, type MemoryCompactionSourceDto } from "@future/core";
import type { SqliteDatabase } from "../connection";

interface CompactionRow {
  id: string; workspace_id: string; summary: string; content_hash: string;
  invalidated_at: string | null; created_at: string;
}
interface SourceRow { source_kind: "memory" | "timeline_event"; source_id: string; content_hash: string }

export class CompactionConflictError extends Error {
  constructor(message: string) { super(message); this.name = "CompactionConflictError"; }
}

export class CompactionRepository {
  constructor(private readonly db: SqliteDatabase) {}

  create(input: CreateCompactionInput): MemoryCompactionDto {
    if (input.sources.length === 0) throw new CompactionConflictError("compaction requires sources");
    this.validateSources(input.workspaceId, input.sources);
    const id = createId("cmp");
    const createdAt = new Date().toISOString();
    const contentHash = createHash("sha256").update(input.summary).digest("hex");
    this.db.transaction(() => {
      this.db.prepare(
        `INSERT INTO compactions (
          id, workspace_id, kind, summary, source_event_ids, created_at, content_hash, invalidated_at
        ) VALUES (@id, @workspaceId, 'memory_summary', @summary, '[]', @createdAt, @contentHash, NULL)`
      ).run({ id, workspaceId: input.workspaceId, summary: input.summary, createdAt, contentHash });
      const insert = this.db.prepare(
        `INSERT INTO memory_compaction_sources (
          compaction_id, source_kind, source_id, content_hash, ordinal
        ) VALUES (@compactionId, @kind, @sourceId, @contentHash, @ordinal)`
      );
      input.sources.forEach((source, ordinal) => insert.run({ compactionId: id, kind: source.kind,
        sourceId: source.id, contentHash: source.contentHash, ordinal }));
    })();
    return this.get(id)!;
  }

  get(id: string): MemoryCompactionDto | undefined {
    const row = this.db.prepare<{ id: string }, CompactionRow>(
      "SELECT * FROM compactions WHERE id = @id"
    ).get({ id });
    if (!row) return undefined;
    const sources = this.db.prepare<{ id: string }, SourceRow>(
      `SELECT source_kind, source_id, content_hash FROM memory_compaction_sources
       WHERE compaction_id = @id ORDER BY ordinal`
    ).all({ id }).map((source) => ({ kind: source.source_kind, id: source.source_id, contentHash: source.content_hash }));
    return { id: row.id, workspaceId: row.workspace_id, summary: row.summary, contentHash: row.content_hash,
      sources, invalidatedAt: row.invalidated_at, createdAt: row.created_at };
  }

  activeSourceKeys(workspaceId: string): string[] {
    return this.db.prepare<{ workspaceId: string }, SourceRow>(
      `SELECT s.source_kind, s.source_id, s.content_hash
       FROM memory_compaction_sources s JOIN compactions c ON c.id = s.compaction_id
       WHERE c.workspace_id = @workspaceId AND c.invalidated_at IS NULL
       ORDER BY c.created_at, s.ordinal`
    ).all({ workspaceId }).map((source) => `${source.source_kind}:${source.source_id}:${source.content_hash}`);
  }

  invalidateForSource(kind: MemoryCompactionSourceDto["kind"], id: string): void {
    this.db.prepare(
      `UPDATE compactions SET invalidated_at = @now WHERE invalidated_at IS NULL AND id IN (
        SELECT compaction_id FROM memory_compaction_sources WHERE source_kind = @kind AND source_id = @id
      )`
    ).run({ kind, id, now: new Date().toISOString() });
  }

  private validateSources(workspaceId: string, sources: readonly MemoryCompactionSourceDto[]): void {
    for (const source of sources) {
      const row = source.kind === "memory"
        ? this.db.prepare<{ id: string }, { workspace_id: string; content_hash: string }>(
            "SELECT workspace_id, content_hash FROM memories WHERE id = @id AND deleted_at IS NULL"
          ).get({ id: source.id })
        : this.eventSource(source.id);
      if (!row || row.workspace_id !== workspaceId || row.content_hash !== source.contentHash) {
        throw new CompactionConflictError("compaction source is missing, stale, or outside the workspace");
      }
    }
  }

  private eventSource(id: string): { workspace_id: string; content_hash: string } | undefined {
    const row = this.db.prepare<{ id: string }, { workspace_id: string; payload_json: string }>(
      "SELECT workspace_id, payload_json FROM events WHERE id = @id"
    ).get({ id });
    return row ? { workspace_id: row.workspace_id,
      content_hash: createHash("sha256").update(row.payload_json).digest("hex") } : undefined;
  }
}
