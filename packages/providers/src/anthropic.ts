import type { ModelDescriptor, ModelProvider, ModelTextChunk, ModelTextRequest } from "./types";

export interface AnthropicProviderOptions {
  id: string;
  apiKey?: string;
  baseUrl?: string;
  models: ModelDescriptor[];
  maxTokens?: number;
}

export type AnthropicProviderErrorCode = "request_failed" | "stream_unavailable" | "invalid_stream";

export class AnthropicProviderError extends Error {
  constructor(readonly code: AnthropicProviderErrorCode) {
    super(`Anthropic provider ${code.replaceAll("_", " ")}`);
    this.name = "AnthropicProviderError";
  }
}

export class AnthropicProvider implements ModelProvider {
  readonly kind = "anthropic";
  readonly id: string;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly models: ModelDescriptor[];
  private readonly maxTokens: number;

  constructor(options: AnthropicProviderOptions) {
    this.id = options.id;
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
    this.models = options.models;
    this.maxTokens = options.maxTokens ?? 1024;
  }

  async listModels(): Promise<ModelDescriptor[]> {
    return this.models;
  }

  async *streamText(request: ModelTextRequest): AsyncIterable<ModelTextChunk> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: this.maxTokens,
        stream: true,
        messages: [{ role: "user", content: request.prompt }],
      }),
      ...(request.signal ? { signal: request.signal } : {}),
    });

    if (!response.ok) throw new AnthropicProviderError("request_failed");
    if (!response.body) throw new AnthropicProviderError("stream_unavailable");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split(/\r?\n/);
        buffer = done ? "" : (lines.pop() ?? "");
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          let frame: { type?: string; delta?: { type?: string; text?: unknown } };
          try {
            frame = JSON.parse(data) as typeof frame;
          } catch {
            throw new AnthropicProviderError("invalid_stream");
          }
          if (frame.type === "message_stop") return;
          if (
            frame.delta?.type === "text_delta" &&
            typeof frame.delta.text === "string" &&
            frame.delta.text.length > 0
          ) {
            yield { text: frame.delta.text };
          }
        }
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }
  }
}
