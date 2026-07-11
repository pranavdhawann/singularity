import {
  EmbeddingAdapterError,
  isAbort,
  validateVectors,
  type EmbeddingAdapter,
  type EmbeddingInput,
  type EmbeddingResult,
  type FetchLike
} from "./embeddings";

export class OllamaEmbeddingAdapter implements EmbeddingAdapter {
  readonly id = "ollama" as const;
  private readonly fetch: FetchLike;
  constructor(private readonly options: { baseUrl: string; fetch?: FetchLike }) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async embed(input: EmbeddingInput): Promise<EmbeddingResult> {
    try {
      const response = await this.fetch(`${this.options.baseUrl.replace(/\/+$/, "")}/api/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: input.model, input: input.texts }),
        ...(input.signal ? { signal: input.signal } : {})
      });
      if (!response.ok) throw new EmbeddingAdapterError("unavailable");
      const body = await response.json() as { embeddings?: unknown };
      return { available: true, vectors: validateVectors(body.embeddings, input.texts.length) };
    } catch (error) {
      if (isAbort(error) || error instanceof EmbeddingAdapterError) throw error;
      throw new EmbeddingAdapterError("unavailable");
    }
  }
}
