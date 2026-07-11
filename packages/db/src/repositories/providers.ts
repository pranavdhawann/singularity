import { createId, type CreateProviderInput, type ProviderConfig, type ProviderKind } from "@future/core";
import type { SqliteDatabase } from "../connection";

interface ProviderRow {
  id: string;
  kind: ProviderKind;
  display_name: string;
  base_url: string | null;
  api_key_ref: string | null;
  is_local: 0 | 1;
  capabilities_json: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderRuntimeConfig extends ProviderConfig {
  secretReference?: string;
}

export class ProviderRepository {
  constructor(private readonly db: SqliteDatabase) {}

  list(): ProviderConfig[] {
    return this.db
      .prepare<[], ProviderRow>("SELECT * FROM providers ORDER BY display_name")
      .all()
      .map(rowToProvider);
  }

  get(id: string): ProviderConfig | undefined {
    const row = this.db
      .prepare<{ id: string }, ProviderRow>("SELECT * FROM providers WHERE id = @id")
      .get({ id });
    return row ? rowToProvider(row) : undefined;
  }

  getRuntimeConfig(id: string): ProviderRuntimeConfig | undefined {
    const row = this.db.prepare<{ id: string }, ProviderRow>("SELECT * FROM providers WHERE id = @id").get({ id });
    if (!row) return undefined;
    return { ...rowToProvider(row), ...(row.api_key_ref ? { secretReference: row.api_key_ref } : {}) };
  }

  create(input: CreateProviderInput): ProviderConfig {
    const now = new Date().toISOString();
    const row: ProviderRow = {
      id: createId("prov"),
      kind: input.kind,
      display_name: input.displayName,
      base_url: input.baseUrl ?? null,
      api_key_ref: input.secretEnvironmentVariable
        ? `env:${input.secretEnvironmentVariable}`
        : null,
      is_local: input.isLocal ? 1 : 0,
      capabilities_json: JSON.stringify({
        streaming: true,
        text: true,
        embeddings: input.kind !== "mock"
      }),
      created_at: now,
      updated_at: now
    };

    this.db
      .prepare(
        `INSERT INTO providers (
          id,
          kind,
          display_name,
          base_url,
          api_key_ref,
          is_local,
          capabilities_json,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @kind,
          @display_name,
          @base_url,
          @api_key_ref,
          @is_local,
          @capabilities_json,
          @created_at,
          @updated_at
        )`
      )
      .run(row);

    return rowToProvider(row);
  }
}

function rowToProvider(row: ProviderRow): ProviderConfig {
  return {
    id: row.id,
    kind: row.kind,
    displayName: row.display_name,
    ...(row.base_url ? { baseUrl: row.base_url } : {}),
    isLocal: row.is_local === 1,
    hasSecret: row.api_key_ref !== null,
    capabilities: JSON.parse(row.capabilities_json) as ProviderConfig["capabilities"],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
