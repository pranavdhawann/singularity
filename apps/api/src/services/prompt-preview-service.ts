import {
  createId,
  type PromptBindingInput,
  type PromptDecisionDto,
  type PromptPreviewDto
} from "@future/core";
import {
  PromptPreviewConflictError,
  PromptPreviewExpiredError,
  type PromptPreviewRepository
} from "@future/db";
import {
  buildExternalPromptPreview,
  hashPromptBinding,
  type ExternalPromptPreviewInput
} from "@future/permissions";

interface PromptPreviewServiceDependencies {
  previews: PromptPreviewRepository;
  now?: () => Date;
}

export interface CreateTurnPromptPreviewInput extends ExternalPromptPreviewInput {
  workspaceId: string;
}

export type PromptPreviewServiceErrorCode =
  | "preview_not_found"
  | "preview_expired"
  | "preview_conflict"
  | "preview_invalidated"
  | "grant_required"
  | "grant_denied";

export class PromptPreviewServiceError extends Error {
  constructor(readonly code: PromptPreviewServiceErrorCode) {
    super(code.replaceAll("_", " "));
    this.name = "PromptPreviewServiceError";
  }
}

export class PromptPreviewService {
  private readonly now: () => Date;

  constructor(private readonly dependencies: PromptPreviewServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  createForTurn(input: CreateTurnPromptPreviewInput): PromptPreviewDto {
    const built = buildExternalPromptPreview(input);
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + 5 * 60 * 1000);
    return this.dependencies.previews.create({
      id: createId("preview"),
      workspaceId: input.workspaceId,
      endpointClassification: "external",
      ...built,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    });
  }

  get(id: string, workspaceId?: string): PromptPreviewDto | undefined {
    return workspaceId
      ? this.dependencies.previews.getForWorkspace(id, workspaceId)
      : this.dependencies.previews.get(id);
  }

  decide(
    previewId: string,
    decision: "approved" | "denied",
    bindingHash: string
  ): PromptDecisionDto {
    try {
      return this.dependencies.previews.decide({
        id: createId("decision"),
        previewId,
        decision,
        bindingHash,
        decidedAt: this.now().toISOString()
      });
    } catch (error) {
      if (error instanceof PromptPreviewExpiredError) {
        throw new PromptPreviewServiceError("preview_expired");
      }
      if (error instanceof PromptPreviewConflictError) {
        throw new PromptPreviewServiceError("preview_conflict");
      }
      throw error;
    }
  }

  requireGrant(previewId: string, binding: PromptBindingInput): PromptDecisionDto {
    const preview = this.dependencies.previews.get(previewId);
    if (!preview) throw new PromptPreviewServiceError("preview_not_found");
    if (this.now().toISOString() > preview.expiresAt) {
      throw new PromptPreviewServiceError("preview_expired");
    }
    if (hashPromptBinding(binding) !== preview.bindingHash) {
      throw new PromptPreviewServiceError("preview_invalidated");
    }
    const decision = this.dependencies.previews.getDecision(previewId);
    if (!decision) throw new PromptPreviewServiceError("grant_required");
    if (decision.decision !== "approved") throw new PromptPreviewServiceError("grant_denied");
    if (decision.bindingHash !== preview.bindingHash) {
      throw new PromptPreviewServiceError("preview_invalidated");
    }
    return decision;
  }

  invalidate(previewId: string): void {
    this.dependencies.previews.invalidate(previewId, this.now().toISOString());
  }
}
