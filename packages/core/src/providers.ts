export type ProviderKind = "openai-compatible" | "ollama" | "mock";

export interface ModelDescriptor {
  id: string;
  displayName: string;
  contextWindow: number;
}

export interface ModelTextRequest {
  prompt: string;
  model: string;
}

export interface ModelTextChunk {
  text: string;
}

export interface EmbeddingRequest {
  input: string;
  model: string;
}

export interface EmbeddingResult {
  embedding: number[];
}

export interface ModelProvider {
  id: string;
  kind: ProviderKind;
  listModels(): Promise<ModelDescriptor[]>;
  streamText(request: ModelTextRequest): AsyncIterable<ModelTextChunk>;
  createEmbedding?(request: EmbeddingRequest): Promise<EmbeddingResult>;
}
