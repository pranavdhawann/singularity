import { describe, expect, it } from "vitest";
import { createTestDb } from "../test-db";
import { ProviderRepository } from "./providers";

describe("ProviderRepository", () => {
  it("persists provider configuration without exposing the secret reference", () => {
    const db = createTestDb();

    try {
      const repository = new ProviderRepository(db.client);
      const provider = repository.create({
        kind: "openai-compatible",
        displayName: "OpenAI compatible",
        baseUrl: "https://models.example/v1",
        secretEnvironmentVariable: "FUTURE_MODEL_KEY",
        isLocal: false,
      });

      expect(provider).toEqual(
        expect.objectContaining({
          kind: "openai-compatible",
          displayName: "OpenAI compatible",
          baseUrl: "https://models.example/v1",
          isLocal: false,
          hasSecret: true,
        }),
      );
      expect(provider).not.toHaveProperty("apiKeyRef");
      expect(repository.list()).toEqual([provider]);
      expect(repository.get(provider.id)).toEqual(provider);

      expect(db.client.prepare("SELECT api_key_ref FROM providers WHERE id = ?").get(provider.id)).toEqual({
        api_key_ref: "env:FUTURE_MODEL_KEY",
      });
    } finally {
      db.close();
    }
  });
});
