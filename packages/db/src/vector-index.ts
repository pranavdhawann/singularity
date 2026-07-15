import { createRequire } from "node:module";
import type { SqliteDatabase } from "./connection";

export interface VectorMatch {
  embeddingId: string;
  distance: number;
}

export interface UpsertVectorInput {
  embeddingId: string;
  workspaceId: string;
  vector: number[];
}

export interface SearchVectorInput {
  workspaceId: string;
  vector: number[];
  limit: number;
}

const require = createRequire(import.meta.url);
// Track connections that already loaded the extension so repeated repository
// construction on one database does not reload it.
const loaded = new WeakSet<object>();

/**
 * Optional sqlite-vec accelerator for persisted embeddings.
 *
 * When the `sqlite-vec` extension loads, embeddings are mirrored into a `vec0`
 * virtual table and queried with native KNN. When it is unavailable (unsupported
 * platform, missing optional dependency) every method degrades to a no-op and
 * callers fall back to the JavaScript cosine path — so behaviour is identical,
 * only slower, without it.
 */
export class SqliteVecIndex {
  private ready = false;
  private dimensions: number | undefined;

  private constructor(
    private readonly db: SqliteDatabase,
    readonly available: boolean,
  ) {}

  static create(db: SqliteDatabase): SqliteVecIndex {
    let available = loaded.has(db);
    if (!available) {
      try {
        (require("sqlite-vec") as { load(db: SqliteDatabase): void }).load(db);
        loaded.add(db);
        available = true;
      } catch {
        available = false;
      }
    }
    return new SqliteVecIndex(db, available);
  }

  upsert(input: UpsertVectorInput): void {
    if (!this.ensureTable(input.vector.length)) return;
    try {
      this.db.prepare(`DELETE FROM source_embeddings_vec WHERE embedding_id = ?`).run(input.embeddingId);
      this.db
        .prepare(`INSERT INTO source_embeddings_vec(embedding_id, workspace_id, embedding) VALUES (?, ?, ?)`)
        .run(input.embeddingId, input.workspaceId, new Float32Array(input.vector));
    } catch {
      // best-effort mirror; the JSON store in source_embeddings remains authoritative
    }
  }

  search(input: SearchVectorInput): VectorMatch[] {
    if (!this.ensureTable(input.vector.length)) return [];
    try {
      const rows = this.db
        .prepare<[Float32Array, string, number], { embedding_id: string; distance: number }>(
          `SELECT embedding_id, distance FROM source_embeddings_vec
           WHERE embedding MATCH ? AND workspace_id = ? ORDER BY distance LIMIT ?`,
        )
        .all(new Float32Array(input.vector), input.workspaceId, input.limit);
      return rows.map((row) => ({ embeddingId: row.embedding_id, distance: row.distance }));
    } catch {
      return [];
    }
  }

  private ensureTable(dimensions: number): boolean {
    if (!this.available || dimensions <= 0) return false;
    if (this.ready) return this.dimensions === dimensions;
    try {
      this.db.exec(
        `CREATE VIRTUAL TABLE IF NOT EXISTS source_embeddings_vec USING vec0(
          embedding_id TEXT PRIMARY KEY, workspace_id TEXT, embedding float[${dimensions}] distance_metric=cosine)`,
      );
      this.ready = true;
      this.dimensions = dimensions;
      return true;
    } catch {
      return false;
    }
  }
}
