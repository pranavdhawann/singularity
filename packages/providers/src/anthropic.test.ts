import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "./anthropic";

function sseResponse(frames: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const f of frames) controller.enqueue(enc.encode(f));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe("AnthropicProvider", () => {
  it("streams text_delta content from the messages endpoint", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      sseResponse([
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AnthropicProvider({
      id: "anthropic_1",
      apiKey: "sk-ant-test",
      models: [{ id: "claude-sonnet-5", displayName: "Claude Sonnet 5", contextWindow: 200000 }],
    });

    const out: string[] = [];
    for await (const chunk of provider.streamText({ prompt: "hi", model: "claude-sonnet-5" })) {
      out.push(chunk.text);
    }
    expect(out.join("")).toBe("Hello");

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      "x-api-key": "sk-ant-test",
      "anthropic-version": "2023-06-01",
    });
    vi.unstubAllGlobals();
  });

  it("throws a typed error on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    );
    const provider = new AnthropicProvider({ id: "a", apiKey: "k", models: [] });
    await expect(async () => {
      for await (const _ of provider.streamText({ prompt: "x", model: "claude-sonnet-5" }));
    }).rejects.toThrow("Anthropic provider request failed");
    vi.unstubAllGlobals();
  });
});
