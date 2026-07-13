import { createId } from "@future/core";
import type { SqliteDatabase } from "../connection";

export interface EmbeddingRecord {
  id: string;
  workspaceId: string;
  sourceKind: string;
  sourceId: string;
  contentHash: string;
  adapter: string;
  model: string;
  dimensions: number;
  vector: number[];
  createdAt: string;
}
export type UpsertEmbeddingInput = Omit<EmbeddingRecord, "id" | "dimensions" | "createdAt">;
export interface EmbeddingSourceKey {
  kind: string;
  id: string;
  contentHash: string;
}

interface EmbeddingRow {
  id: string;
  workspace_id: string;
  source_kind: string;
  source_id: string;
  content_hash: string;
  adapter: string;
  model: string;
  dimensions: number;
  vector_json: string;
  created_at: string;
}

export class EmbeddingDimensionError extends Error {
  constructor() {
    super("embedding dimensions are invalid or inconsistent");
    this.name = "EmbeddingDimensionError";
  }
}

export class EmbeddingRepository {
  constructor(private readonly db: SqliteDatabase) {}

  upsert(input: UpsertEmbeddingInput): EmbeddingRecord {
    if (input.vector.length === 0 || input.vector.some((value) => !Number.isFinite(value))) {
      throw new EmbeddingDimensionError();
    }
    const expected = this.db
      .prepare<{ adapter: string; model: string }, { dimensions: number }>(
        `SELECT dimensions FROM source_embeddings WHERE adapter = @adapter AND model = @model LIMIT 1`,
      )
      .get({ adapter: input.adapter, model: input.model });
    if (expected && expected.dimensions !== input.vector.length) throw new EmbeddingDimensionError();
    const id = createId("emb");
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO source_embeddings (
        id, workspace_id, source_kind, source_id, content_hash, adapter, model,
        dimensions, vector_json, created_at
      ) VALUES (
        @id, @workspaceId, @sourceKind, @sourceId, @contentHash, @adapter, @model,
        @dimensions, @vectorJson, @createdAt
      ) ON CONFLICT(source_kind, source_id, content_hash, adapter, model) DO UPDATE SET
        workspace_id = excluded.workspace_id, dimensions = excluded.dimensions,
        vector_json = excluded.vector_json, created_at = excluded.created_at`,
      )
      .run({ ...input, id, dimensions: input.vector.length, vectorJson: JSON.stringify(input.vector), createdAt });
    return this.find(
      input.workspaceId,
      input.sourceKind,
      input.sourceId,
      input.contentHash,
      input.adapter,
      input.model,
    )!;
  }

  listForSources(input: {
    workspaceId: string;
    adapter: string;
    model: string;
    sources: readonly EmbeddingSourceKey[];
  }): EmbeddingRecord[] {
    return input.sources.flatMap((source) => {
      const found = this.find(
        input.workspaceId,
        source.kind,
        source.id,
        source.contentHash,
        input.adapter,
        input.model,
      );
      return found ? [found] : [];
    });
  }

  invalidateSource(workspaceId: string, sourceKind: string, sourceId: string, currentContentHash: string): void {
    this.db
      .prepare(
        `DELETE FROM source_embeddings WHERE workspace_id = @workspaceId
       AND source_kind = @sourceKind AND source_id = @sourceId AND content_hash <> @currentContentHash`,
      )
      .run({ workspaceId, sourceKind, sourceId, currentContentHash });
  }

  private find(
    workspaceId: string,
    sourceKind: string,
    sourceId: string,
    contentHash: string,
    adapter: string,
    model: string,
  ): EmbeddingRecord | undefined {
    const row = this.db
      .prepare<Record<string, string>, EmbeddingRow>(
        `SELECT * FROM source_embeddings WHERE workspace_id = @workspaceId
       AND source_kind = @sourceKind AND source_id = @sourceId AND content_hash = @contentHash
       AND adapter = @adapter AND model = @model`,
      )
      .get({ workspaceId, sourceKind, sourceId, contentHash, adapter, model });
    return row ? mapEmbedding(row) : undefined;
  }
}

function mapEmbedding(row: EmbeddingRow): EmbeddingRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    contentHash: row.content_hash,
    adapter: row.adapter,
    model: row.model,
    dimensions: row.dimensions,
    vector: JSON.parse(row.vector_json) as number[],
    createdAt: row.created_at,
  };
}
