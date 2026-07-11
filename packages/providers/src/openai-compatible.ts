import type { ModelDescriptor, ModelProvider, ModelTextChunk, ModelTextRequest } from "./types";

export interface OpenAiCompatibleProviderOptions {
  id: string;
  baseUrl: string;
  apiKey?: string;
  models: ModelDescriptor[];
}

export type OpenAiCompatibleProviderErrorCode =
  | "request_failed"
  | "stream_unavailable"
  | "invalid_stream";

export class OpenAiCompatibleProviderError extends Error {
  constructor(readonly code: OpenAiCompatibleProviderErrorCode) {
    super(`OpenAI-compatible provider ${code.replaceAll("_", " ")}`);
    this.name = "OpenAiCompatibleProviderError";
  }
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
        stream: true
      }),
      ...(request.signal ? { signal: request.signal } : {})
    });

    if (!response.ok) {
      throw new OpenAiCompatibleProviderError("request_failed");
    }
    if (!response.body) throw new OpenAiCompatibleProviderError("stream_unavailable");

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
          const data = line.startsWith("data:") ? line.slice(5).trim() : "";
          if (!data) continue;
          if (data === "[DONE]") return;
          let frame: { choices?: Array<{ delta?: { content?: unknown } }> };
          try {
            frame = JSON.parse(data) as typeof frame;
          } catch {
            throw new OpenAiCompatibleProviderError("invalid_stream");
          }
          const text = frame.choices?.[0]?.delta?.content;
          if (typeof text === "string" && text.length > 0) yield { text };
        }
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }
  }
}
