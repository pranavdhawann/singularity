import type { ModelDescriptor, ModelProvider, ModelTextChunk, ModelTextRequest } from "./types";

export interface OllamaProviderOptions {
  id?: string;
  baseUrl?: string;
  model?: string;
}

export class OllamaProvider implements ModelProvider {
  readonly id: string;
  readonly kind = "ollama";
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: OllamaProviderOptions = {}) {
    this.id = options.id ?? "ollama";
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");
    this.model = options.model ?? "llama3.2";
  }

  async listModels(): Promise<ModelDescriptor[]> {
    return [{ id: this.model, displayName: this.model, contextWindow: 8192 }];
  }

  async *streamText(request: ModelTextRequest): AsyncIterable<ModelTextChunk> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with ${response.status}`);
    }

    const body = (await response.json()) as { response?: string };
    yield { text: body.response ?? "" };
  }
}
