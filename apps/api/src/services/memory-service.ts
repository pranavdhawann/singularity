import {
  createEvent,
  type CreateCompactionInput,
  type CreateNamespaceInput,
  type MemoryCompactionDto,
  type MemoryDto,
  type MemoryMutationInput,
  type MemoryNamespaceDto
} from "@future/core";
import {
  MemoryConflictError,
  type CompactionRepository,
  type CreateMemoryRecordInput,
  type EmbeddingRepository,
  type EventRepository,
  type MemoryRepository,
  type NamespaceRepository,
  type SqliteDatabase
} from "@future/db";

interface MemoryServiceDependencies {
  db: SqliteDatabase;
  memories: MemoryRepository;
  namespaces: NamespaceRepository;
  compactions: CompactionRepository;
  embeddings: EmbeddingRepository;
  events: EventRepository;
}

export class MemoryServiceError extends Error {
  constructor(readonly code: "not_found" | "conflict" | "invalid_state", readonly details?: Record<string, unknown>) {
    super(code.replaceAll("_", " ")); this.name = "MemoryServiceError";
  }
}

export class MemoryService {
  constructor(private readonly dependencies: MemoryServiceDependencies) {}

  create(input: CreateMemoryRecordInput): MemoryDto {
    return this.dependencies.memories.create(input, (memory) => {
      this.append(memory.workspaceId, memory.reviewState === "approved" ? "memory.approved" : "memory.proposed",
        memory.reviewState === "approved" ? "Memory approved" : "Memory proposed", { memoryId: memory.id, version: memory.version });
    });
  }

  createNamespace(input: CreateNamespaceInput): MemoryNamespaceDto {
    return this.dependencies.db.transaction(() => {
      const namespace = this.dependencies.namespaces.create(input);
      this.append(input.workspaceId, "memory.namespace.created", "Memory namespace created",
        { namespaceId: namespace.id, parentId: namespace.parentId });
      return namespace;
    })();
  }

  mutate(id: string, input: MemoryMutationInput): MemoryDto {
    const current = this.dependencies.memories.get(id);
    if (!current) throw new MemoryServiceError("not_found");
    try {
      return this.dependencies.memories.mutate(id, input, (next) => {
        this.dependencies.embeddings.invalidateSource(next.workspaceId, "memory", next.id, hashFromDb(this.dependencies.db, next.id));
        this.dependencies.compactions.invalidateForSource("memory", next.id);
        if (next.statement !== current.statement) this.append(next.workspaceId, "memory.revised", "Memory revised", payload(next));
        if (next.reviewState !== current.reviewState) {
          const type = next.reviewState === "approved" ? "memory.approved"
            : next.reviewState === "outdated" ? "memory.outdated" : `memory.${next.reviewState}`;
          this.append(next.workspaceId, type, `Memory ${next.reviewState}`, payload(next));
        }
        if (next.pinned !== current.pinned) this.append(next.workspaceId,
          next.pinned ? "memory.pinned" : "memory.unpinned", next.pinned ? "Memory pinned" : "Memory unpinned", payload(next));
        if (input.namespaceIds) this.append(next.workspaceId, "memory.namespace.assigned", "Memory namespaces assigned",
          { ...payload(next), namespaceIds: next.namespaceIds, primaryNamespaceId: next.primaryNamespaceId ?? null });
      });
    } catch (error) { throw this.mapError(error); }
  }

  delete(id: string, expectedVersion: number): MemoryDto {
    const current = this.dependencies.memories.get(id);
    if (!current) throw new MemoryServiceError("not_found");
    try {
      return this.dependencies.memories.delete(id, expectedVersion, (next) => {
        this.dependencies.embeddings.invalidateSource(next.workspaceId, "memory", next.id, "deleted");
        this.dependencies.compactions.invalidateForSource("memory", next.id);
        this.append(next.workspaceId, "memory.deleted", "Memory deleted", payload(next));
      });
    } catch (error) { throw this.mapError(error); }
  }

  createCompaction(input: CreateCompactionInput): MemoryCompactionDto {
    return this.dependencies.db.transaction(() => {
      const compaction = this.dependencies.compactions.create(input);
      this.append(input.workspaceId, "memory.compacted", "Memory compacted",
        { compactionId: compaction.id, sourceCount: compaction.sources.length });
      return compaction;
    })();
  }

  private append(workspaceId: string, type: string, title: string, eventPayload: Record<string, unknown>): void {
    this.dependencies.events.appendInCurrentTransaction(createEvent({ workspaceId, type, actor: "system", title,
      payload: eventPayload, privacy: { labels: ["local"] } }));
  }

  private mapError(error: unknown): Error {
    if (error instanceof MemoryConflictError) return new MemoryServiceError("conflict",
      { expectedVersion: error.expectedVersion, actualVersion: error.actualVersion });
    return error instanceof Error ? error : new MemoryServiceError("invalid_state");
  }
}

function payload(memory: MemoryDto): Record<string, unknown> { return { memoryId: memory.id, version: memory.version }; }
function hashFromDb(db: SqliteDatabase, id: string): string {
  return db.prepare<{ id: string }, { content_hash: string }>("SELECT content_hash FROM memories WHERE id = @id")
    .get({ id })?.content_hash ?? "";
}
