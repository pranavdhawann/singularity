import { describe, expect, it } from "vitest";
import { MockProvider } from "./mock";

describe("MockProvider", () => {
  it("streams deterministic chunks", async () => {
    const provider = new MockProvider();
    const chunks: string[] = [];

    for await (const chunk of provider.streamText({ prompt: "hello", model: "mock" })) {
      chunks.push(chunk.text);
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe("Mock response for: hello");
  });

  it("stops before yielding when cancelled", async () => {
    const provider = new MockProvider();
    const controller = new AbortController();
    controller.abort();

    const consume = async () => {
      for await (const _chunk of provider.streamText({
        prompt: "hello",
        model: "mock",
        signal: controller.signal
      })) {
        // The aborted stream must not yield.
      }
    };

    await expect(consume()).rejects.toMatchObject({ name: "AbortError" });
  });
});
