import type { ModelProfile, ModelProvider, ProviderConfig, SecretStore } from "@future/core";
import type { ModelProfileRepository, ProviderRepository } from "@future/db";
import {
  AnthropicProvider,
  MockProvider,
  OllamaProvider,
  OpenAiCompatibleProvider,
  OpenAiProvider,
} from "@future/providers";
import { OllamaEmbeddingAdapter, OpenAiCompatibleEmbeddingAdapter, type EmbeddingAdapter } from "@future/retrieval";

export type ProviderServiceErrorCode =
  | "model_profile_not_found"
  | "provider_not_found"
  | "secret_store_not_configured"
  | "missing_external_secret"
  | "invalid_external_endpoint";

export class ProviderServiceError extends Error {
  constructor(readonly code: ProviderServiceErrorCode) {
    super(code);
    this.name = "ProviderServiceError";
  }
}

/** Reads directly from process.env, matching the pre-SecretStore behavior. Used when no store is injected. */
const ENV_ONLY_SECRETS: SecretStore = {
  get: (name: string) => process.env[name],
  set: () => {
    /* no-op: this fallback store does not persist secrets */
  },
  list: () => [],
};

export interface ProviderBuildExtra {
  model: string;
  contextWindow?: number;
  baseUrl?: string;
  secretEnvironmentVariable?: string;
}

/** Pure factory: turns a persisted ProviderConfig + runtime extras into a live ModelProvider. */
export function buildProvider(config: ProviderConfig, extra: ProviderBuildExtra, secrets: SecretStore): ModelProvider {
  switch (config.kind) {
    case "mock":
      return new MockProvider();

    case "ollama":
      return new OllamaProvider({
        id: config.id,
        ...(extra.baseUrl ? { baseUrl: extra.baseUrl } : {}),
        model: extra.model,
      });

    case "openai-compatible": {
      if (!extra.baseUrl || !isHttpUrl(extra.baseUrl)) {
        throw new ProviderServiceError("invalid_external_endpoint");
      }
      const apiKey = extra.secretEnvironmentVariable ? secrets.get(extra.secretEnvironmentVariable) : undefined;
      if (!apiKey) {
        throw new ProviderServiceError("missing_external_secret");
      }
      return new OpenAiCompatibleProvider({
        id: config.id,
        baseUrl: extra.baseUrl,
        apiKey,
        models: [{ id: extra.model, displayName: extra.model, contextWindow: extra.contextWindow ?? 0 }],
      });
    }

    case "anthropic": {
      const apiKey = extra.secretEnvironmentVariable ? secrets.get(extra.secretEnvironmentVariable) : undefined;
      return new AnthropicProvider({
        id: config.id,
        ...(apiKey ? { apiKey } : {}),
        ...(extra.baseUrl ? { baseUrl: extra.baseUrl } : {}),
        models: [{ id: extra.model, displayName: extra.model, contextWindow: extra.contextWindow ?? 200000 }],
      });
    }

    case "openai": {
      const apiKey = extra.secretEnvironmentVariable ? secrets.get(extra.secretEnvironmentVariable) : undefined;
      return new OpenAiProvider({
        id: config.id,
        ...(apiKey ? { apiKey } : {}),
        ...(extra.baseUrl ? { baseUrl: extra.baseUrl } : {}),
      });
    }

    default:
      throw new ProviderServiceError("secret_store_not_configured");
  }
}

export class ProviderService {
  constructor(
    private readonly providers: ProviderRepository,
    private readonly profiles: ModelProfileRepository,
    private readonly secrets: SecretStore = ENV_ONLY_SECRETS,
  ) {}

  getRuntime(profileId: string): { provider: ModelProvider; profile: ModelProfile; isLocal: boolean } {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new ProviderServiceError("model_profile_not_found");
    }

    const config = this.providers.get(profile.providerId);
    if (!config) {
      throw new ProviderServiceError("provider_not_found");
    }

    if (config.kind === "mock") {
      return {
        provider: buildProvider(config, { model: profile.model, contextWindow: profile.contextWindow }, this.secrets),
        profile,
        isLocal: config.isLocal,
      };
    }

    if (config.kind === "ollama") {
      return {
        provider: buildProvider(
          config,
          {
            model: profile.model,
            contextWindow: profile.contextWindow,
            ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
          },
          this.secrets,
        ),
        profile,
        isLocal: config.isLocal,
      };
    }

    if (config.kind === "openai-compatible" || config.kind === "anthropic" || config.kind === "openai") {
      const runtimeConfig = this.providers.getRuntimeConfig(config.id);
      const baseUrl = runtimeConfig?.baseUrl;
      const reference = runtimeConfig?.secretReference;
      const secretEnvironmentVariable = reference?.startsWith("env:") ? reference.slice(4) : undefined;

      if (config.kind === "openai-compatible") {
        if (!baseUrl || !isHttpUrl(baseUrl)) {
          throw new ProviderServiceError("invalid_external_endpoint");
        }
        const apiKey = secretEnvironmentVariable ? this.secrets.get(secretEnvironmentVariable) : undefined;
        if (!reference?.startsWith("env:") || !apiKey) {
          throw new ProviderServiceError("missing_external_secret");
        }
      }

      return {
        provider: buildProvider(
          config,
          {
            model: profile.model,
            contextWindow: profile.contextWindow,
            ...(baseUrl ? { baseUrl } : {}),
            ...(secretEnvironmentVariable ? { secretEnvironmentVariable } : {}),
          },
          this.secrets,
        ),
        profile,
        isLocal: config.isLocal,
      };
    }

    throw new ProviderServiceError("secret_store_not_configured");
  }

  getEmbeddingRuntime(profile: ModelProfile): { adapter: EmbeddingAdapter; model: string } | undefined {
    if (!profile.embeddingModel) return undefined;
    const config = this.providers.getRuntimeConfig(profile.providerId);
    if (!config?.capabilities.embeddings) return undefined;
    if (config.kind === "ollama") {
      return {
        adapter: new OllamaEmbeddingAdapter({ baseUrl: config.baseUrl ?? "http://127.0.0.1:11434" }),
        model: profile.embeddingModel,
      };
    }
    if (config.kind === "openai-compatible" && config.baseUrl && config.secretReference) {
      return {
        adapter: new OpenAiCompatibleEmbeddingAdapter({
          baseUrl: config.baseUrl,
          apiKeyRef: config.secretReference,
          resolveSecret: resolveEnvironmentSecret,
        }),
        model: profile.embeddingModel,
      };
    }
    return undefined;
  }
}

function resolveEnvironmentSecret(reference: string): string | undefined {
  return reference.startsWith("env:") ? process.env[reference.slice(4)] : undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
