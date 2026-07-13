import {
  EmbeddingAdapterError,
  isAbort,
  validateVectors,
  type EmbeddingAdapter,
  type EmbeddingInput,
  type EmbeddingResult,
  type FetchLike,
} from "./embeddings";

interface OpenAiEmbeddingRow {
  index?: unknown;
  embedding?: unknown;
}

export class OpenAiCompatibleEmbeddingAdapter implements EmbeddingAdapter {
  readonly id = "openai-compatible" as const;
  private readonly fetch: FetchLike;
  constructor(
    private readonly options: {
      baseUrl: string;
      apiKeyRef: string;
      resolveSecret: (reference: string) => string | undefined;
      fetch?: FetchLike;
    },
  ) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async embed(input: EmbeddingInput): Promise<EmbeddingResult> {
    const secret = this.options.resolveSecret(this.options.apiKeyRef);
    if (!secret) throw new EmbeddingAdapterError("missing_secret");
    try {
      const response = await this.fetch(`${this.options.baseUrl.replace(/\/+$/, "")}/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
        body: JSON.stringify({ model: input.model, input: input.texts }),
        ...(input.signal ? { signal: input.signal } : {}),
      });
      if (!response.ok) throw new EmbeddingAdapterError("unavailable");
      const body = (await response.json()) as { data?: unknown };
      if (!Array.isArray(body.data) || body.data.length !== input.texts.length) {
        throw new EmbeddingAdapterError("invalid_response");
      }
      const ordered = [...(body.data as OpenAiEmbeddingRow[])].sort((a, b) => Number(a.index) - Number(b.index));
      if (ordered.some((row, index) => row.index !== index)) throw new EmbeddingAdapterError("invalid_response");
      return {
        available: true,
        vectors: validateVectors(
          ordered.map((row) => row.embedding),
          input.texts.length,
        ),
      };
    } catch (error) {
      if (isAbort(error) || error instanceof EmbeddingAdapterError) throw error;
      throw new EmbeddingAdapterError("unavailable");
    }
  }
}
