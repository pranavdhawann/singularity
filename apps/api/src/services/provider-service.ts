import type { ModelProfile, ModelProvider } from "@future/core";
import type { ModelProfileRepository, ProviderRepository } from "@future/db";
import { MockProvider, OllamaProvider } from "@future/providers";

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
}
