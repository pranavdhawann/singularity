export type ProviderKind = "openai-compatible" | "ollama" | "mock";

export interface ModelDescriptor {
  id: string;
  displayName: string;
  contextWindow: number;
}

export interface ModelTextRequest {
  prompt: string;
  model: string;
  signal?: AbortSignal;
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

export interface CreateProviderInput {
  kind: ProviderKind;
  displayName: string;
  baseUrl?: string;
  secretEnvironmentVariable?: string;
  isLocal: boolean;
}

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  displayName: string;
  baseUrl?: string;
  isLocal: boolean;
  hasSecret: boolean;
  capabilities: {
    streaming: boolean;
    text: boolean;
    embeddings: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelProfileInput {
  providerId: string;
  name: string;
  model: string;
  contextWindow: number;
  purpose: string;
  temperature?: number;
  privacyPolicy: "local_only" | "prompt_preview";
}

export interface ModelProfile extends CreateModelProfileInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}
