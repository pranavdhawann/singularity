import { ModelProfileRepository, ProviderRepository, createTestDb } from "@future/db";
import { describe, expect, it } from "vitest";
import { ProviderService, ProviderServiceError } from "./provider-service";

describe("ProviderService", () => {
  it("resolves a persisted mock profile", () => {
    const db = createTestDb();

    try {
      const providers = new ProviderRepository(db.client);
      const profiles = new ModelProfileRepository(db.client);
      const provider = providers.create({
        kind: "mock",
        displayName: "Mock",
        isLocal: true
      });
      const profile = profiles.create({
        providerId: provider.id,
        name: "Offline test",
        model: "mock",
        contextWindow: 4096,
        purpose: "testing",
        privacyPolicy: "local_only"
      });

      const runtime = new ProviderService(providers, profiles).getRuntime(profile.id);

      expect(runtime.profile).toEqual(profile);
      expect(runtime.provider.kind).toBe("mock");
    } finally {
      db.close();
    }
  });

  it("uses the persisted Ollama model", async () => {
    const db = createTestDb();

    try {
      const providers = new ProviderRepository(db.client);
      const profiles = new ModelProfileRepository(db.client);
      const provider = providers.create({
        kind: "ollama",
        displayName: "Local Ollama",
        baseUrl: "http://127.0.0.1:11434",
        isLocal: true
      });
      const profile = profiles.create({
        providerId: provider.id,
        name: "Private model",
        model: "qwen3:8b",
        contextWindow: 32768,
        purpose: "general",
        privacyPolicy: "local_only"
      });

      const runtime = new ProviderService(providers, profiles).getRuntime(profile.id);

      expect(runtime.provider.kind).toBe("ollama");
      await expect(runtime.provider.listModels()).resolves.toEqual([
        expect.objectContaining({ id: "qwen3:8b" })
      ]);
    } finally {
      db.close();
    }
  });

  it("reports an unknown model profile", () => {
    const db = createTestDb();

    try {
      const service = new ProviderService(
        new ProviderRepository(db.client),
        new ModelProfileRepository(db.client)
      );

      expect(() => service.getRuntime("profile_missing")).toThrowError(
        expect.objectContaining<Partial<ProviderServiceError>>({
          code: "model_profile_not_found"
        })
      );
    } finally {
      db.close();
    }
  });
});
