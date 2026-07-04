import type { ModelProvider } from "./types";
import { MockProvider } from "./mock";

export class ProviderRegistry {
  private readonly providers = new Map<string, ModelProvider>();

  constructor(initialProviders: ModelProvider[] = [new MockProvider()]) {
    for (const provider of initialProviders) {
      this.register(provider);
    }
  }

  register(provider: ModelProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(providerId: string): ModelProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not registered: ${providerId}`);
    }
    return provider;
  }

  list(): ModelProvider[] {
    return [...this.providers.values()];
  }
}
