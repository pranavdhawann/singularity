import { OpenAiCompatibleProvider } from "./openai-compatible";
import type { ModelDescriptor, ModelProvider, ModelTextChunk, ModelTextRequest } from "./types";

export interface OpenAiProviderOptions {
  id: string;
  apiKey?: string;
  baseUrl?: string;
  models?: ModelDescriptor[];
}

const DEFAULT_MODELS: ModelDescriptor[] = [
  { id: "gpt-4o", displayName: "GPT-4o", contextWindow: 128000 },
  { id: "gpt-4o-mini", displayName: "GPT-4o mini", contextWindow: 128000 },
];

export class OpenAiProvider implements ModelProvider {
  readonly kind = "openai";
  readonly id: string;
  private readonly inner: OpenAiCompatibleProvider;
  private readonly models: ModelDescriptor[];

  constructor(options: OpenAiProviderOptions) {
    this.id = options.id;
    this.models = options.models ?? DEFAULT_MODELS;
    this.inner = new OpenAiCompatibleProvider({
      id: options.id,
      baseUrl: options.baseUrl ?? "https://api.openai.com/v1",
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
      models: this.models,
    });
  }

  async listModels(): Promise<ModelDescriptor[]> {
    return this.models;
  }

  streamText(request: ModelTextRequest): AsyncIterable<ModelTextChunk> {
    return this.inner.streamText(request);
  }
}
