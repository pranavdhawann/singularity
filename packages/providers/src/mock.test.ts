import { describe, expect, it } from "vitest";
import { MockProvider } from "./mock";

describe("MockProvider", () => {
  it("streams deterministic chunks", async () => {
    const provider = new MockProvider();
    const chunks: string[] = [];

    for await (const chunk of provider.streamText({ prompt: "hello", model: "mock" })) {
      chunks.push(chunk.text);
    }

    expect(chunks.join("")).toContain("Mock response");
  });
});
