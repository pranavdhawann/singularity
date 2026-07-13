import { describe, expect, it } from "vitest";
import type { ImportJobDto, PromptBindingInput, PromptDecisionDto, PromptPreviewDto } from "./index";

describe("Phase 4 contracts", () => {
  it("carries resumable import checkpoints", () => {
    const job = {
      id: "job_1",
      importId: "import_1",
      workspaceId: "workspace_1",
      filename: "notes.md",
      mediaType: "text/markdown",
      byteSize: 42,
      state: "indexing",
      documentIndex: 1,
      nextChunkIndex: 3,
      documentCount: 2,
      completedDocumentCount: 1,
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:00:01.000Z",
    } satisfies ImportJobDto;

    expect(job.nextChunkIndex).toBe(3);
  });

  it("binds an immutable prompt decision to execution inputs", () => {
    const binding = {
      turnId: "turn_1",
      providerId: "provider_1",
      modelProfileId: "profile_1",
      model: "test-model",
      contextPackId: "pack_1",
      contextPackHash: "pack-hash",
      promptHash: "prompt-hash",
    } satisfies PromptBindingInput;
    const preview = {
      ...binding,
      id: "preview_1",
      workspaceId: "workspace_1",
      endpointClassification: "external",
      redactedPrompt: "safe prompt",
      estimatedTokens: 2,
      privacyLabels: ["private"],
      redactionCounts: { secret: 1 },
      selectedSources: [],
      excludedSources: [],
      bindingHash: "binding-hash",
      createdAt: "2026-07-11T00:00:00.000Z",
      expiresAt: "2026-07-11T00:05:00.000Z",
    } satisfies PromptPreviewDto;
    const decision = {
      id: "decision_1",
      previewId: preview.id,
      decision: "approved",
      bindingHash: preview.bindingHash,
      decidedAt: "2026-07-11T00:01:00.000Z",
    } satisfies PromptDecisionDto;

    expect(decision.bindingHash).toBe(preview.bindingHash);
  });
});
