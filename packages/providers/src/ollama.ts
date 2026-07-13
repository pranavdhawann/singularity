import type { ModelDescriptor, ModelProvider, ModelTextChunk, ModelTextRequest } from "./types";

export interface OllamaProviderOptions {
  id?: string;
  baseUrl?: string;
  model?: string;
}

export class OllamaStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaStreamError";
  }
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
        stream: true,
      }),
      ...(request.signal ? { signal: request.signal } : {}),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with ${response.status}`);
    }

    if (!response.body) {
      throw new OllamaStreamError("Ollama response body was missing");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      request.signal?.throwIfAborted();
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: !done });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          const chunk = parseStreamLine(line);
          if (chunk.response) yield { text: chunk.response };
          if (chunk.done) return;
        }
        newlineIndex = buffer.indexOf("\n");
      }

      if (done) break;
    }

    const finalLine = buffer.trim();
    if (finalLine) {
      const chunk = parseStreamLine(finalLine);
      if (chunk.response) yield { text: chunk.response };
    }
  }
}

function parseStreamLine(line: string): { response?: string; done?: boolean } {
  try {
    return JSON.parse(line) as { response?: string; done?: boolean };
  } catch {
    throw new OllamaStreamError("Ollama returned malformed streaming JSON");
  }
}
