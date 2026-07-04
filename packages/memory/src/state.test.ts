import { describe, expect, it } from "vitest";
import { transitionMemory } from "./state";

describe("transitionMemory", () => {
  it("promotes proposed memory to approved memory", () => {
    const next = transitionMemory({
      reviewState: "proposed",
      action: "approve",
      actor: "user"
    });

    expect(next.reviewState).toBe("approved");
    expect(next.revisionReason).toBe("user approved memory");
  });
});
