import { createId } from "@future/core";
import type { SqliteDatabase } from "../connection";
import { SqliteVecIndex } from "../vector-index";

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
  private readonly vectorIndex: SqliteVecIndex;

  constructor(
    private readonly db: SqliteDatabase,
    vectorIndex?: SqliteVecIndex,
  ) {
    this.vectorIndex = vectorIndex ?? SqliteVecIndex.create(db);
  }

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
    const record = this.find(
      input.workspaceId,
      input.sourceKind,
      input.sourceId,
      input.contentHash,
      input.adapter,
      input.model,
    )!;
    // Mirror into the optional sqlite-vec index for native KNN (best-effort).
    this.vectorIndex.upsert({ embeddingId: record.id, workspaceId: record.workspaceId, vector: record.vector });
    return record;
  }

  /**
   * Returns the persisted embeddings most similar to `queryVector` in a
   * workspace for the given adapter/model. Uses sqlite-vec KNN when available
   * and otherwise falls back to an exact JavaScript cosine scan.
   */
  searchSimilar(input: {
    workspaceId: string;
    adapter: string;
    model: string;
    queryVector: number[];
    limit: number;
  }): EmbeddingRecord[] {
    const matches = this.vectorIndex.search({
      workspaceId: input.workspaceId,
      vector: input.queryVector,
      limit: input.limit * 2,
    });
    if (matches.length > 0) {
      const records = matches
        .map((match) => this.getById(match.embeddingId))
        .filter(
          (record): record is EmbeddingRecord => record?.adapter === input.adapter && record.model === input.model,
        );
      if (records.length > 0) return records.slice(0, input.limit);
    }
    // Fallback: exact cosine over the workspace's persisted vectors.
    const pool = this.listForWorkspace(input.workspaceId, input.adapter, input.model);
    return pool
      .map((record) => ({ record, score: cosineSimilarity(input.queryVector, record.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit)
      .map((entry) => entry.record);
  }

  getById(id: string): EmbeddingRecord | undefined {
    const row = this.db
      .prepare<{ id: string }, EmbeddingRow>(`SELECT * FROM source_embeddings WHERE id = @id`)
      .get({ id });
    return row ? mapEmbedding(row) : undefined;
  }

  private listForWorkspace(workspaceId: string, adapter: string, model: string): EmbeddingRecord[] {
    return this.db
      .prepare<Record<string, string>, EmbeddingRow>(
        `SELECT * FROM source_embeddings WHERE workspace_id = @workspaceId AND adapter = @adapter AND model = @model`,
      )
      .all({ workspaceId, adapter, model })
      .map(mapEmbedding);
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

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
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
