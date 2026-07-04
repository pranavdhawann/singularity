import type { ModelDescriptor, ModelProvider, ModelTextChunk, ModelTextRequest } from "./types";

export class MockProvider implements ModelProvider {
  readonly id = "mock";
  readonly kind = "mock";

  async listModels(): Promise<ModelDescriptor[]> {
    return [
      {
        id: "mock",
        displayName: "Mock",
        contextWindow: 4096
      }
    ];
  }

  async *streamText(request: ModelTextRequest): AsyncIterable<ModelTextChunk> {
    yield { text: `Mock response for: ${request.prompt}` };
  }
}
