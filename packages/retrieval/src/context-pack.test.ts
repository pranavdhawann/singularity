import { describe, expect, it } from "vitest";
import { buildContextPack } from "./context-pack";

describe("buildContextPack", () => {
  it("keeps selected items inside the requested token budget", () => {
    const pack = buildContextPack({
      command: "What did we decide?",
      budgetTokens: 80,
      memories: [
        { id: "mem_1", text: "Use SQLite as the source of truth.", tokenCount: 9, score: 10 }
      ],
      chunks: [],
      recentEvents: []
    });

    expect(pack.items.map((item) => item.id)).toEqual(["mem_1"]);
    expect(pack.estimatedTokens).toBeLessThanOrEqual(80);
  });
});
