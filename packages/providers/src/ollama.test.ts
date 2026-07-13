import { afterEach, describe, expect, it, vi } from "vitest";
import { OllamaProvider } from "./ollama";

describe("OllamaProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses newline-delimited response chunks across byte boundaries", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"response":"Local ","done":false}\n{"res'));
        controller.enqueue(encoder.encode('ponse":"answer","done":true}\n'));
        controller.close();
      },
    });
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, _init) => new Response(body, { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const provider = new OllamaProvider({ model: "qwen3:8b" });
    const chunks: string[] = [];

    for await (const chunk of provider.streamText({ prompt: "hello", model: "qwen3:8b" })) {
      chunks.push(chunk.text);
    }

    expect(chunks).toEqual(["Local ", "answer"]);
    const init = fetch.mock.calls[0]?.[1];
    expect(init?.body && JSON.parse(init.body as string)).toEqual(
      expect.objectContaining({ model: "qwen3:8b", stream: true }),
    );
  });

  it("forwards cancellation to fetch", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      init?.signal?.throwIfAborted();
      return new Response();
    });
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    controller.abort();
    const provider = new OllamaProvider();

    const consume = async () => {
      for await (const _chunk of provider.streamText({
        prompt: "hello",
        model: "llama3.2",
        signal: controller.signal,
      })) {
        // The aborted request must not yield.
      }
    };

    await expect(consume()).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/generate",
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
