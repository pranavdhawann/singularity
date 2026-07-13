import type { PromptPreviewDto } from "@future/core";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../test-db";
import { PromptPreviewConflictError, PromptPreviewExpiredError, PromptPreviewRepository } from "./prompt-previews";

const preview: PromptPreviewDto = {
  id: "preview_1",
  workspaceId: "w_1",
  turnId: "turn_1",
  providerId: "provider_1",
  modelProfileId: "profile_1",
  model: "model-1",
  endpointClassification: "external",
  contextPackId: "pack_1",
  contextPackHash: "pack-hash",
  redactedPrompt: "safe prompt",
  promptHash: "prompt-hash",
  bindingHash: "binding-hash",
  estimatedTokens: 3,
  privacyLabels: ["private"],
  redactionCounts: { secret: 1 },
  selectedSources: [],
  excludedSources: [],
  createdAt: "2026-07-11T00:00:00.000Z",
  expiresAt: "2026-07-11T00:05:00.000Z",
};

describe("PromptPreviewRepository", () => {
  it("stores an immutable preview and one immutable decision", () => {
    const db = createTestDb();
    try {
      const repository = new PromptPreviewRepository(db.client);
      expect(repository.create(preview)).toEqual(preview);
      expect(repository.get(preview.id)).toEqual(preview);

      const decision = repository.decide({
        id: "decision_1",
        previewId: preview.id,
        decision: "approved",
        bindingHash: preview.bindingHash,
        decidedAt: "2026-07-11T00:01:00.000Z",
      });

      expect(decision.decision).toBe("approved");
      expect(() =>
        repository.decide({
          id: "decision_2",
          previewId: preview.id,
          decision: "denied",
          bindingHash: preview.bindingHash,
          decidedAt: "2026-07-11T00:02:00.000Z",
        }),
      ).toThrow(PromptPreviewConflictError);
    } finally {
      db.close();
    }
  });

  it("rejects mismatched and expired decisions", () => {
    const db = createTestDb();
    try {
      const repository = new PromptPreviewRepository(db.client);
      repository.create(preview);
      expect(() =>
        repository.decide({
          id: "decision_1",
          previewId: preview.id,
          decision: "approved",
          bindingHash: "changed",
          decidedAt: "2026-07-11T00:01:00.000Z",
        }),
      ).toThrow(PromptPreviewConflictError);
      expect(() =>
        repository.decide({
          id: "decision_2",
          previewId: preview.id,
          decision: "approved",
          bindingHash: preview.bindingHash,
          decidedAt: "2026-07-11T00:06:00.000Z",
        }),
      ).toThrow(PromptPreviewExpiredError);
    } finally {
      db.close();
    }
  });

  it("invalidates an undecided preview", () => {
    const db = createTestDb();
    try {
      const repository = new PromptPreviewRepository(db.client);
      repository.create(preview);
      repository.invalidate(preview.id, "2026-07-11T00:01:00.000Z");
      expect(() =>
        repository.decide({
          id: "decision_1",
          previewId: preview.id,
          decision: "approved",
          bindingHash: preview.bindingHash,
          decidedAt: "2026-07-11T00:02:00.000Z",
        }),
      ).toThrow(PromptPreviewConflictError);
    } finally {
      db.close();
    }
  });
});
