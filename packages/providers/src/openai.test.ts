import { describe, expect, it, vi } from "vitest";
import { OpenAiProvider } from "./openai";

describe("OpenAiProvider", () => {
  it("targets the OpenAI base URL with a bearer key", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n'));
          c.close();
        },
      });
      return new Response(body, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiProvider({ id: "openai_1", apiKey: "sk-openai" });
    expect(provider.kind).toBe("openai");
    const out: string[] = [];
    for await (const chunk of provider.streamText({ prompt: "x", model: "gpt-4o" })) out.push(chunk.text);
    expect(out.join("")).toBe("hi");
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.openai.com/v1/chat/completions");
    vi.unstubAllGlobals();
  });
});
