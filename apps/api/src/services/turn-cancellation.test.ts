import { describe, expect, it } from "vitest";
import { TurnCancellationRegistry } from "./turn-cancellation";

describe("TurnCancellationRegistry", () => {
  it("isolates, aborts, and removes active turn controllers", () => {
    const registry = new TurnCancellationRegistry();
    const first = registry.start("turn_1");
    const second = registry.start("turn_2");

    expect(() => registry.start("turn_1")).toThrow(/already active/);
    expect(registry.cancel("turn_1")).toBe(true);
    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
    registry.finish("turn_1");
    expect(registry.cancel("turn_1")).toBe(false);
  });
});
