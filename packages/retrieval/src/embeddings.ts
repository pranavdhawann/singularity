export interface EmbeddingInput { model: string; texts: readonly string[]; signal?: AbortSignal }
export interface EmbeddingResult { available: boolean; vectors: number[][] }
export interface EmbeddingAdapter {
  readonly id: "noop" | "ollama" | "openai-compatible";
  embed(input: EmbeddingInput): Promise<EmbeddingResult>;
}
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class EmbeddingAdapterError extends Error {
  constructor(readonly code: "unavailable" | "invalid_response" | "missing_secret") {
    super(`embedding adapter ${code.replaceAll("_", " ")}`);
    this.name = "EmbeddingAdapterError";
  }
}

export class NoopEmbeddingAdapter implements EmbeddingAdapter {
  readonly id = "noop" as const;
  async embed(_input: EmbeddingInput): Promise<EmbeddingResult> {
    return { available: false, vectors: [] };
  }
}

export function validateVectors(vectors: unknown, expectedCount: number): number[][] {
  if (!Array.isArray(vectors) || vectors.length !== expectedCount || vectors.length === 0) {
    throw new EmbeddingAdapterError("invalid_response");
  }
  let dimensions: number | undefined;
  return vectors.map((candidate) => {
    if (!Array.isArray(candidate) || candidate.length === 0 || candidate.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      throw new EmbeddingAdapterError("invalid_response");
    }
    dimensions ??= candidate.length;
    if (candidate.length !== dimensions) throw new EmbeddingAdapterError("invalid_response");
    return [...candidate] as number[];
  });
}

export function isAbort(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
