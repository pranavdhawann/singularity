import { describe, expect, it } from "vitest";
import { createTestDb } from "../test-db";
import { ModelProfileRepository } from "./model-profiles";
import { ProviderRepository } from "./providers";

describe("ModelProfileRepository", () => {
  it("round trips a model profile linked to a provider", () => {
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
        name: "Local default",
        model: "llama3.2",
        contextWindow: 8192,
        purpose: "general",
        privacyPolicy: "local_only"
      });

      expect(profiles.get(profile.id)).toEqual(profile);
      expect(profiles.list(provider.id)).toEqual([profile]);
    } finally {
      db.close();
    }
  });
});
