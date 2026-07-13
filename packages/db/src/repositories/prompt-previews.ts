import type { PromptDecisionDto, PromptPreviewDto } from "@future/core";
import type { SqliteDatabase } from "../connection";

interface PromptPreviewRow {
  id: string;
  workspace_id: string;
  turn_id: string;
  provider_id: string;
  model_profile_id: string;
  model: string;
  endpoint_classification: "external";
  context_pack_id: string;
  context_pack_hash: string;
  redacted_prompt: string;
  prompt_hash: string;
  binding_hash: string;
  estimated_tokens: number;
  privacy_labels_json: string;
  redaction_counts_json: string;
  selected_sources_json: string;
  excluded_sources_json: string;
  created_at: string;
  expires_at: string;
  invalidated_at: string | null;
}

interface PromptDecisionRow {
  id: string;
  preview_id: string;
  decision: "approved" | "denied";
  binding_hash: string;
  decided_at: string;
}

export class PromptPreviewConflictError extends Error {
  constructor() {
    super("prompt preview conflict");
    this.name = "PromptPreviewConflictError";
  }
}

export class PromptPreviewExpiredError extends Error {
  constructor() {
    super("prompt preview expired");
    this.name = "PromptPreviewExpiredError";
  }
}

export class PromptPreviewRepository {
  constructor(private readonly db: SqliteDatabase) {}

  create(preview: PromptPreviewDto): PromptPreviewDto {
    this.db
      .prepare(
        `INSERT INTO prompt_previews (
        id, workspace_id, turn_id, provider_id, model_profile_id, model,
        endpoint_classification, context_pack_id, context_pack_hash,
        redacted_prompt, prompt_hash, binding_hash, estimated_tokens,
        privacy_labels_json, redaction_counts_json, selected_sources_json,
        excluded_sources_json, created_at, expires_at, invalidated_at
      ) VALUES (
        @id, @workspaceId, @turnId, @providerId, @modelProfileId, @model,
        @endpointClassification, @contextPackId, @contextPackHash,
        @redactedPrompt, @promptHash, @bindingHash, @estimatedTokens,
        @privacyLabelsJson, @redactionCountsJson, @selectedSourcesJson,
        @excludedSourcesJson, @createdAt, @expiresAt, NULL
      )`,
      )
      .run({
        ...preview,
        privacyLabelsJson: JSON.stringify(preview.privacyLabels),
        redactionCountsJson: JSON.stringify(preview.redactionCounts),
        selectedSourcesJson: JSON.stringify(preview.selectedSources),
        excludedSourcesJson: JSON.stringify(preview.excludedSources),
      });
    return this.get(preview.id)!;
  }

  get(id: string): PromptPreviewDto | undefined {
    const row = this.db
      .prepare<{ id: string }, PromptPreviewRow>("SELECT * FROM prompt_previews WHERE id = @id")
      .get({ id });
    return row ? mapPreview(row) : undefined;
  }

  getForWorkspace(id: string, workspaceId: string): PromptPreviewDto | undefined {
    const row = this.db
      .prepare<{ id: string; workspaceId: string }, PromptPreviewRow>(
        "SELECT * FROM prompt_previews WHERE id = @id AND workspace_id = @workspaceId",
      )
      .get({ id, workspaceId });
    return row ? mapPreview(row) : undefined;
  }

  getForTurn(turnId: string): PromptPreviewDto | undefined {
    const row = this.db
      .prepare<{ turnId: string }, PromptPreviewRow>(
        "SELECT * FROM prompt_previews WHERE turn_id = @turnId ORDER BY created_at DESC LIMIT 1",
      )
      .get({ turnId });
    return row ? mapPreview(row) : undefined;
  }

  getDecision(previewId: string): PromptDecisionDto | undefined {
    const row = this.db
      .prepare<{ previewId: string }, PromptDecisionRow>("SELECT * FROM prompt_decisions WHERE preview_id = @previewId")
      .get({ previewId });
    return row ? mapDecision(row) : undefined;
  }

  decide(decision: PromptDecisionDto): PromptDecisionDto {
    const save = this.db.transaction(() => {
      const row = this.db
        .prepare<{ id: string }, PromptPreviewRow>("SELECT * FROM prompt_previews WHERE id = @id")
        .get({ id: decision.previewId });
      if (
        !row ||
        row.invalidated_at ||
        row.binding_hash !== decision.bindingHash ||
        this.getDecision(decision.previewId)
      ) {
        throw new PromptPreviewConflictError();
      }
      if (decision.decidedAt > row.expires_at) throw new PromptPreviewExpiredError();
      this.db
        .prepare(
          `INSERT INTO prompt_decisions (id, preview_id, decision, binding_hash, decided_at)
         VALUES (@id, @previewId, @decision, @bindingHash, @decidedAt)`,
        )
        .run(decision);
    });
    save();
    return this.getDecision(decision.previewId)!;
  }

  invalidate(id: string, invalidatedAt: string): void {
    const changed = this.db
      .prepare(
        `UPDATE prompt_previews SET invalidated_at = @invalidatedAt
       WHERE id = @id AND invalidated_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM prompt_decisions WHERE preview_id = @id)`,
      )
      .run({ id, invalidatedAt });
    if (changed.changes !== 1) throw new PromptPreviewConflictError();
  }

  isInvalidated(id: string): boolean {
    return (
      this.db
        .prepare<{ id: string }, number>(
          "SELECT COUNT(*) FROM prompt_previews WHERE id = @id AND invalidated_at IS NOT NULL",
        )
        .pluck()
        .get({ id }) === 1
    );
  }
}

function mapPreview(row: PromptPreviewRow): PromptPreviewDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    turnId: row.turn_id,
    providerId: row.provider_id,
    modelProfileId: row.model_profile_id,
    model: row.model,
    endpointClassification: row.endpoint_classification,
    contextPackId: row.context_pack_id,
    contextPackHash: row.context_pack_hash,
    redactedPrompt: row.redacted_prompt,
    promptHash: row.prompt_hash,
    bindingHash: row.binding_hash,
    estimatedTokens: row.estimated_tokens,
    privacyLabels: JSON.parse(row.privacy_labels_json) as string[],
    redactionCounts: JSON.parse(row.redaction_counts_json) as Record<string, number>,
    selectedSources: JSON.parse(row.selected_sources_json) as PromptPreviewDto["selectedSources"],
    excludedSources: JSON.parse(row.excluded_sources_json) as PromptPreviewDto["excludedSources"],
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function mapDecision(row: PromptDecisionRow): PromptDecisionDto {
  return {
    id: row.id,
    previewId: row.preview_id,
    decision: row.decision,
    bindingHash: row.binding_hash,
    decidedAt: row.decided_at,
  };
}
