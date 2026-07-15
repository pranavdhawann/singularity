import type { SecretStore } from "@future/core";
import { ModelProfileRepository, ProviderRepository, createTestDb } from "@future/db";
import { AnthropicProvider, OpenAiProvider } from "@future/providers";
import { describe, expect, it } from "vitest";
import { ProviderService, ProviderServiceError, buildProvider } from "./provider-service";

describe("ProviderService", () => {
  it("resolves a persisted mock profile", () => {
    const db = createTestDb();

    try {
      const providers = new ProviderRepository(db.client);
      const profiles = new ModelProfileRepository(db.client);
      const provider = providers.create({
        kind: "mock",
        displayName: "Mock",
        isLocal: true,
      });
      const profile = profiles.create({
        providerId: provider.id,
        name: "Offline test",
        model: "mock",
        contextWindow: 4096,
        purpose: "testing",
        privacyPolicy: "local_only",
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
        isLocal: true,
      });
      const profile = profiles.create({
        providerId: provider.id,
        name: "Private model",
        model: "qwen3:8b",
        contextWindow: 32768,
        purpose: "general",
        privacyPolicy: "local_only",
      });

      const runtime = new ProviderService(providers, profiles).getRuntime(profile.id);

      expect(runtime.provider.kind).toBe("ollama");
      await expect(runtime.provider.listModels()).resolves.toEqual([expect.objectContaining({ id: "qwen3:8b" })]);
    } finally {
      db.close();
    }
  });

  it("reports an unknown model profile", () => {
    const db = createTestDb();

    try {
      const service = new ProviderService(new ProviderRepository(db.client), new ModelProfileRepository(db.client));

      expect(() => service.getRuntime("profile_missing")).toThrowError(
        expect.objectContaining<Partial<ProviderServiceError>>({
          code: "model_profile_not_found",
        }),
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
        kind: "openai-compatible",
        displayName: "External",
        baseUrl: "http://127.0.0.1:9999/v1",
        isLocal: false,
        secretEnvironmentVariable: "FUTURE_TEST_OPENAI_KEY",
      });
      const profile = profiles.create({
        providerId: provider.id,
        name: "External model",
        model: "model-1",
        contextWindow: 8192,
        purpose: "general",
        privacyPolicy: "prompt_preview",
      });
      const service = new ProviderService(providers, profiles);

      delete process.env.FUTURE_TEST_OPENAI_KEY;
      expect(() => service.getRuntime(profile.id)).toThrowError(
        expect.objectContaining<Partial<ProviderServiceError>>({ code: "missing_external_secret" }),
      );
      process.env.FUTURE_TEST_OPENAI_KEY = "resolved-at-call-time";
      const runtime = service.getRuntime(profile.id);

      expect(runtime.provider.kind).toBe("openai-compatible");
      await expect(runtime.provider.listModels()).resolves.toEqual([
        { id: "model-1", displayName: "model-1", contextWindow: 8192 },
      ]);
    } finally {
      if (previous === undefined) delete process.env.FUTURE_TEST_OPENAI_KEY;
      else process.env.FUTURE_TEST_OPENAI_KEY = previous;
      db.close();
    }
  });
});

describe("buildProvider", () => {
  function stubSecrets(values: Record<string, string>): SecretStore {
    return {
      get: (name: string) => values[name],
      set: () => {
        throw new Error("not implemented");
      },
      list: () => Object.keys(values),
    };
  }

  it("builds a native Anthropic provider and resolves its key from the SecretStore", async () => {
    const secrets = stubSecrets({ FUTURE_ANTHROPIC_API_KEY: "sk-ant-x" });

    const provider = buildProvider(
      {
        id: "p1",
        kind: "anthropic",
        displayName: "Claude",
        isLocal: false,
        hasSecret: true,
        capabilities: { streaming: true, text: true, embeddings: false },
        createdAt: "t",
        updatedAt: "t",
      },
      { secretEnvironmentVariable: "FUTURE_ANTHROPIC_API_KEY", model: "claude-sonnet-5" },
      secrets,
    );

    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.kind).toBe("anthropic");
    await expect(provider.listModels()).resolves.toEqual([
      { id: "claude-sonnet-5", displayName: "claude-sonnet-5", contextWindow: 200000 },
    ]);
  });

  it("builds a native OpenAI provider and resolves its key from the SecretStore", () => {
    const secrets = stubSecrets({ FUTURE_OPENAI_API_KEY: "sk-openai-x" });

    const provider = buildProvider(
      {
        id: "p2",
        kind: "openai",
        displayName: "OpenAI",
        isLocal: false,
        hasSecret: true,
        capabilities: { streaming: true, text: true, embeddings: false },
        createdAt: "t",
        updatedAt: "t",
      },
      { secretEnvironmentVariable: "FUTURE_OPENAI_API_KEY", model: "gpt-4o" },
      secrets,
    );

    expect(provider).toBeInstanceOf(OpenAiProvider);
    expect(provider.kind).toBe("openai");
  });

  it("uses the profile's contextWindow when provided for Anthropic", () => {
    const secrets = stubSecrets({});

    const provider = buildProvider(
      {
        id: "p3",
        kind: "anthropic",
        displayName: "Claude",
        isLocal: false,
        hasSecret: false,
        capabilities: { streaming: true, text: true, embeddings: false },
        createdAt: "t",
        updatedAt: "t",
      },
      { model: "claude-sonnet-5", contextWindow: 64000 },
      secrets,
    );

    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it("still builds the mock provider", () => {
    const secrets = stubSecrets({});

    const provider = buildProvider(
      {
        id: "p4",
        kind: "mock",
        displayName: "Mock",
        isLocal: true,
        hasSecret: false,
        capabilities: { streaming: true, text: true, embeddings: false },
        createdAt: "t",
        updatedAt: "t",
      },
      { model: "mock" },
      secrets,
    );

    expect(provider.kind).toBe("mock");
  });
});
