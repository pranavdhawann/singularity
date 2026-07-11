import type { ModelProfile, ModelProvider } from "@future/core";
import type { ModelProfileRepository, ProviderRepository } from "@future/db";
import { MockProvider, OllamaProvider } from "@future/providers";
import {
  OllamaEmbeddingAdapter,
  OpenAiCompatibleEmbeddingAdapter,
  type EmbeddingAdapter
} from "@future/retrieval";

export type ProviderServiceErrorCode =
  | "model_profile_not_found"
  | "provider_not_found"
  | "secret_store_not_configured";

export class ProviderServiceError extends Error {
  constructor(readonly code: ProviderServiceErrorCode) {
    super(code);
    this.name = "ProviderServiceError";
  }
}

export class ProviderService {
  constructor(
    private readonly providers: ProviderRepository,
    private readonly profiles: ModelProfileRepository
  ) {}

  getRuntime(profileId: string): { provider: ModelProvider; profile: ModelProfile } {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new ProviderServiceError("model_profile_not_found");
    }

    const config = this.providers.get(profile.providerId);
    if (!config) {
      throw new ProviderServiceError("provider_not_found");
    }

    if (config.kind === "mock") {
      return { provider: new MockProvider(), profile };
    }

    if (config.kind === "ollama") {
      return {
        provider: new OllamaProvider({
          id: config.id,
          ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
          model: profile.model
        }),
        profile
      };
    }

    throw new ProviderServiceError("secret_store_not_configured");
  }

  getEmbeddingRuntime(profile: ModelProfile): { adapter: EmbeddingAdapter; model: string } | undefined {
    if (!profile.embeddingModel) return undefined;
    const config = this.providers.getRuntimeConfig(profile.providerId);
    if (!config?.capabilities.embeddings) return undefined;
    if (config.kind === "ollama") {
      return { adapter: new OllamaEmbeddingAdapter({ baseUrl: config.baseUrl ?? "http://127.0.0.1:11434" }),
        model: profile.embeddingModel };
    }
    if (config.kind === "openai-compatible" && config.baseUrl && config.secretReference) {
      return { adapter: new OpenAiCompatibleEmbeddingAdapter({ baseUrl: config.baseUrl,
        apiKeyRef: config.secretReference, resolveSecret: resolveEnvironmentSecret }), model: profile.embeddingModel };
    }
    return undefined;
  }
}

function resolveEnvironmentSecret(reference: string): string | undefined {
  return reference.startsWith("env:") ? process.env[reference.slice(4)] : undefined;
}
