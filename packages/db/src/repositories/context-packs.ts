import type { ContextPackInspection } from "@future/core";
import type { SqliteDatabase } from "../connection";

interface ContextPackRow {
  id: string;
  workspace_id: string;
  model_profile_id: string | null;
  budget_json: string;
  items_json: string;
  redactions_json: string;
  created_at: string;
}

interface StoredContextMetadata {
  turnId: string;
  providerId: string;
  model: string;
  estimatedTokens: number;
}

export class ContextPackRepository {
  constructor(private readonly db: SqliteDatabase) {}

  create(pack: ContextPackInspection): void {
    this.db.prepare(
      `INSERT INTO context_packs (
        id, workspace_id, command_event_id, model_profile_id,
        budget_json, items_json, redactions_json, created_at
      ) VALUES (
        @id, @workspaceId, NULL, @modelProfileId,
        @budgetJson, @itemsJson, @redactionsJson, @createdAt
      )`
    ).run({
      id: pack.id,
      workspaceId: pack.workspaceId,
      modelProfileId: pack.modelProfileId,
      budgetJson: JSON.stringify({
        turnId: pack.turnId,
        providerId: pack.providerId,
        model: pack.model,
        estimatedTokens: pack.estimatedTokens
      }),
      itemsJson: JSON.stringify(pack.items),
      redactionsJson: JSON.stringify({ count: pack.redactionCount }),
      createdAt: pack.createdAt
    });
  }

  get(id: string): ContextPackInspection | undefined {
    const row = this.db.prepare<{ id: string }, ContextPackRow>(
      `SELECT id, workspace_id, model_profile_id, budget_json, items_json,
              redactions_json, created_at
       FROM context_packs WHERE id = @id`
    ).get({ id });
    if (!row || !row.model_profile_id) return undefined;

    const metadata = JSON.parse(row.budget_json) as StoredContextMetadata;
    const redactions = JSON.parse(row.redactions_json) as { count?: number };
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      turnId: metadata.turnId,
      modelProfileId: row.model_profile_id,
      providerId: metadata.providerId,
      model: metadata.model,
      items: JSON.parse(row.items_json) as ContextPackInspection["items"],
      estimatedTokens: metadata.estimatedTokens,
      redactionCount: redactions.count ?? 0,
      createdAt: row.created_at
    };
  }
}
