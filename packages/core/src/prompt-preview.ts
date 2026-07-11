import type { SourceReference } from "./assistant";

export interface PromptBindingInput {
  turnId: string;
  providerId: string;
  modelProfileId: string;
  model: string;
  contextPackId: string;
  contextPackHash: string;
  promptHash: string;
}

export interface PromptPreviewDto extends PromptBindingInput {
  id: string;
  workspaceId: string;
  endpointClassification: "external";
  redactedPrompt: string;
  estimatedTokens: number;
  privacyLabels: string[];
  redactionCounts: Record<string, number>;
  selectedSources: SourceReference[];
  excludedSources: SourceReference[];
  bindingHash: string;
  createdAt: string;
  expiresAt: string;
}

export interface PromptDecisionDto {
  id: string;
  previewId: string;
  decision: "approved" | "denied";
  bindingHash: string;
  decidedAt: string;
}
