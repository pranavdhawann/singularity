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

  it("resolves an OpenAI-compatible secret from the environment at call time", async () => {
    const db = createTestDb();
    const previous = process.env.FUTURE_TEST_OPENAI_KEY;
    try {
      const providers = new ProviderRepository(db.client);
      const profiles = new ModelProfileRepository(db.client);
      const provider = providers.create({
        kind: "openai-compatible", displayName: "External",
        baseUrl: "http://127.0.0.1:9999/v1", isLocal: false,
        secretEnvironmentVariable: "FUTURE_TEST_OPENAI_KEY"
      });
      const profile = profiles.create({
        providerId: provider.id, name: "External model", model: "model-1",
        contextWindow: 8192, purpose: "general", privacyPolicy: "prompt_preview"
      });
      const service = new ProviderService(providers, profiles);

      delete process.env.FUTURE_TEST_OPENAI_KEY;
      expect(() => service.getRuntime(profile.id)).toThrowError(
        expect.objectContaining<Partial<ProviderServiceError>>({ code: "missing_external_secret" })
      );
      process.env.FUTURE_TEST_OPENAI_KEY = "resolved-at-call-time";
      const runtime = service.getRuntime(profile.id);

      expect(runtime.provider.kind).toBe("openai-compatible");
      await expect(runtime.provider.listModels()).resolves.toEqual([
        { id: "model-1", displayName: "model-1", contextWindow: 8192 }
      ]);
    } finally {
      if (previous === undefined) delete process.env.FUTURE_TEST_OPENAI_KEY;
      else process.env.FUTURE_TEST_OPENAI_KEY = previous;
      db.close();
    }
  });
});
