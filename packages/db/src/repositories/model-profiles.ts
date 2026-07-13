import { createId, type CreateModelProfileInput, type ModelProfile } from "@future/core";
import type { SqliteDatabase } from "../connection";

interface ModelProfileRow {
  id: string;
  provider_id: string;
  name: string;
  model: string;
  embedding_model: string | null;
  context_window: number;
  purpose: string;
  temperature: number | null;
  privacy_policy: "local_only" | "prompt_preview";
  created_at: string;
  updated_at: string;
}

export class ModelProfileRepository {
  constructor(private readonly db: SqliteDatabase) {}

  list(providerId?: string): ModelProfile[] {
    const rows = providerId
      ? this.db
          .prepare<{ providerId: string }, ModelProfileRow>(
            "SELECT * FROM model_profiles WHERE provider_id = @providerId ORDER BY name",
          )
          .all({ providerId })
      : this.db.prepare<[], ModelProfileRow>("SELECT * FROM model_profiles ORDER BY name").all();
    return rows.map(rowToModelProfile);
  }

  get(id: string): ModelProfile | undefined {
    const row = this.db
      .prepare<{ id: string }, ModelProfileRow>("SELECT * FROM model_profiles WHERE id = @id")
      .get({ id });
    return row ? rowToModelProfile(row) : undefined;
  }

  create(input: CreateModelProfileInput): ModelProfile {
    const now = new Date().toISOString();
    const row: ModelProfileRow = {
      id: createId("profile"),
      provider_id: input.providerId,
      name: input.name,
      model: input.model,
      embedding_model: input.embeddingModel ?? null,
      context_window: input.contextWindow,
      purpose: input.purpose,
      temperature: input.temperature ?? null,
      privacy_policy: input.privacyPolicy,
      created_at: now,
      updated_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO model_profiles (
          id,
          provider_id,
          name,
          model,
          embedding_model,
          context_window,
          purpose,
          temperature,
          privacy_policy,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @provider_id,
          @name,
          @model,
          @embedding_model,
          @context_window,
          @purpose,
          @temperature,
          @privacy_policy,
          @created_at,
          @updated_at
        )`,
      )
      .run(row);

    return rowToModelProfile(row);
  }
}

function rowToModelProfile(row: ModelProfileRow): ModelProfile {
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    model: row.model,
    ...(row.embedding_model ? { embeddingModel: row.embedding_model } : {}),
    contextWindow: row.context_window,
    purpose: row.purpose,
    ...(row.temperature === null ? {} : { temperature: row.temperature }),
    privacyPolicy: row.privacy_policy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
