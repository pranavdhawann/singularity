import { PromptPreviewRepository, createTestDb } from "@future/db";
import { describe, expect, it } from "vitest";
import { PromptPreviewService, PromptPreviewServiceError } from "./prompt-preview-service";

const input = {
  workspaceId: "w_1",
  turnId: "turn_1",
  providerId: "provider_1",
  modelProfileId: "profile_1",
  model: "model-1",
  contextPackId: "pack_1",
  contextPackHash: "pack-hash",
  instructions: "Be useful",
  userText: "Contact user@example.com",
  segments: [],
};

describe("PromptPreviewService", () => {
  it("creates a redacted preview and requires its exact approved binding", () => {
    const db = createTestDb();
    try {
      const service = new PromptPreviewService({
        previews: new PromptPreviewRepository(db.client),
        now: () => new Date("2026-07-11T00:00:00.000Z"),
      });
      const preview = service.createForTurn(input);
      expect(preview.redactedPrompt).not.toContain("user@example.com");

      const decision = service.decide(preview.id, "approved", preview.bindingHash);
      expect(decision.decision).toBe("approved");
      expect(
        service.requireGrant(preview.id, {
          turnId: preview.turnId,
          providerId: preview.providerId,
          modelProfileId: preview.modelProfileId,
          model: preview.model,
          contextPackId: preview.contextPackId,
          contextPackHash: preview.contextPackHash,
          promptHash: preview.promptHash,
        }),
      ).toEqual(decision);
    } finally {
      db.close();
    }
  });

  it("rejects denial and changed execution inputs", () => {
    const db = createTestDb();
    try {
      const service = new PromptPreviewService({
        previews: new PromptPreviewRepository(db.client),
        now: () => new Date("2026-07-11T00:00:00.000Z"),
      });
      const denied = service.createForTurn(input);
      service.decide(denied.id, "denied", denied.bindingHash);
      expect(() =>
        service.requireGrant(denied.id, {
          turnId: denied.turnId,
          providerId: denied.providerId,
          modelProfileId: denied.modelProfileId,
          model: denied.model,
          contextPackId: denied.contextPackId,
          contextPackHash: denied.contextPackHash,
          promptHash: denied.promptHash,
        }),
      ).toThrowError(expect.objectContaining<Partial<PromptPreviewServiceError>>({ code: "grant_denied" }));

      const changed = service.createForTurn({ ...input, turnId: "turn_2" });
      service.decide(changed.id, "approved", changed.bindingHash);
      expect(() =>
        service.requireGrant(changed.id, {
          turnId: changed.turnId,
          providerId: changed.providerId,
          modelProfileId: changed.modelProfileId,
          model: "changed-model",
          contextPackId: changed.contextPackId,
          contextPackHash: changed.contextPackHash,
          promptHash: changed.promptHash,
        }),
      ).toThrowError(expect.objectContaining<Partial<PromptPreviewServiceError>>({ code: "preview_invalidated" }));
    } finally {
      db.close();
    }
  });
});
