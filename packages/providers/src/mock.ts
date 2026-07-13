import type { ModelDescriptor, ModelProvider, ModelTextChunk, ModelTextRequest } from "./types";

export class MockProvider implements ModelProvider {
  readonly id = "mock";
  readonly kind = "mock";

  async listModels(): Promise<ModelDescriptor[]> {
    return [
      {
        id: "mock",
        displayName: "Mock",
        contextWindow: 4096,
      },
    ];
  }

  async *streamText(request: ModelTextRequest): AsyncIterable<ModelTextChunk> {
    const chunks = `Mock response for: ${request.prompt}`.match(/\S+\s*/g) ?? [];
    for (const text of chunks) {
      request.signal?.throwIfAborted();
      yield { text };
    }
  }
}
