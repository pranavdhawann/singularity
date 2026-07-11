import { describe, expect, it } from "vitest";
import {
  PromptRedactionError,
  buildExternalPromptPreview,
  hashPromptBinding
} from "./prompt-preview";

const baseInput = {
  turnId: "turn_1",
  providerId: "provider_1",
  modelProfileId: "profile_1",
  model: "test-model",
  contextPackId: "pack_1",
  contextPackHash: "pack-hash",
  instructions: "Never expose sk-system-secret123",
  userText: "Email me at user@example.com",
  segments: [
    {
      source: {
        kind: "document_chunk" as const,
        id: "chunk_1",
        workspaceId: "workspace_1",
        title: "Private note",
        contentHash: "chunk-hash"
      },
      text: "Bearer abcdefghijk",
      privacyLabels: ["private"]
    }
  ]
};

describe("buildExternalPromptPreview", () => {
  it("redacts the complete rendered prompt and returns safe counts", () => {
    const result = buildExternalPromptPreview(baseInput);

    expect(result.redactedPrompt).not.toMatch(/sk-system|user@example|abcdefghijk/);
    expect(result.redactedPrompt).toContain("[REDACTED_EMAIL]");
    expect(result.redactionCounts).toEqual({ email: 1, secret: 2 });
    expect(result.privacyLabels).toEqual(["private"]);
    expect(result.selectedSources).toEqual([baseInput.segments[0]?.source]);
    expect(result.excludedSources).toEqual([]);
  });

  it("changes the binding whenever an execution input changes", () => {
    const original = buildExternalPromptPreview(baseInput);
    const changedModel = buildExternalPromptPreview({ ...baseInput, model: "other-model" });
    const changedContext = buildExternalPromptPreview({
      ...baseInput,
      contextPackHash: "other-pack-hash"
    });

    expect(changedModel.bindingHash).not.toBe(original.bindingHash);
    expect(changedContext.bindingHash).not.toBe(original.bindingHash);
    expect(hashPromptBinding({
      turnId: baseInput.turnId,
      providerId: baseInput.providerId,
      modelProfileId: baseInput.modelProfileId,
      model: baseInput.model,
      contextPackId: baseInput.contextPackId,
      contextPackHash: baseInput.contextPackHash,
      promptHash: original.promptHash
    })).toBe(original.bindingHash);
  });

  it("records excluded sources without rendering their text", () => {
    const excluded = {
      source: {
        kind: "memory" as const,
        id: "memory_1",
        workspaceId: "workspace_1",
        title: "Excluded",
        contentHash: "memory-hash"
      },
      text: "do not render this",
      privacyLabels: ["restricted"],
      excluded: true
    };
    const result = buildExternalPromptPreview({
      ...baseInput,
      segments: [...baseInput.segments, excluded]
    });

    expect(result.redactedPrompt).not.toContain(excluded.text);
    expect(result.excludedSources).toEqual([excluded.source]);
    expect(result.privacyLabels).toEqual(["private", "restricted"]);
  });

  it("fails closed without leaking text when redaction throws", () => {
    const sensitiveMarker = "never-persist-this-marker";

    expect(() => buildExternalPromptPreview(
      { ...baseInput, userText: sensitiveMarker },
      { redact: () => { throw new Error(sensitiveMarker); } }
    )).toThrow(PromptRedactionError);

    try {
      buildExternalPromptPreview(
        { ...baseInput, userText: sensitiveMarker },
        { redact: () => { throw new Error(sensitiveMarker); } }
      );
    } catch (error) {
      expect((error as Error).message).toBe("prompt redaction failed");
    }
  });
});
