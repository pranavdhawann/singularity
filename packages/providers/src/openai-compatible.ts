import type { ModelDescriptor, ModelProvider, ModelTextChunk, ModelTextRequest } from "./types";

export interface OpenAiCompatibleProviderOptions {
  id: string;
  baseUrl: string;
  apiKey?: string;
  models: ModelDescriptor[];
}

export class OpenAiCompatibleProvider implements ModelProvider {
  readonly kind = "openai-compatible";
  readonly id: string;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly models: ModelDescriptor[];

  constructor(options: OpenAiCompatibleProviderOptions) {
    this.id = options.id;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.models = options.models;
  }

  async listModels(): Promise<ModelDescriptor[]> {
    return this.models;
  }

  async *streamText(request: ModelTextRequest): AsyncIterable<ModelTextChunk> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: request.model,
        messages: [{ role: "user", content: request.prompt }],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI-compatible request failed with ${response.status}`);
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    yield { text: body.choices?.[0]?.message?.content ?? "" };
  }
}
