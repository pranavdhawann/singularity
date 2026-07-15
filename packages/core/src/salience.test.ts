import { describe, expect, it } from "vitest";
import { extractSalientFacts } from "./salience";

describe("extractSalientFacts", () => {
  it("captures first-person declarative facts", () => {
    const facts = extractSalientFacts("My dog's name is Ada. I work at Acme.");
    expect(facts).toContain("My dog's name is Ada.");
    expect(facts).toContain("I work at Acme.");
  });

  it("ignores questions and non-first-person sentences", () => {
    const facts = extractSalientFacts("What is the weather? The sky is blue.");
    expect(facts).toEqual([]);
  });

  it("ignores overly long sentences (likely not a durable fact)", () => {
    const long = "I " + "really ".repeat(60) + "think so.";
    expect(extractSalientFacts(long)).toEqual([]);
  });

  it("dedupes repeated facts within one message", () => {
    expect(extractSalientFacts("I like tea. I like tea.")).toEqual(["I like tea."]);
  });

  it("returns an empty array for empty input", () => {
    expect(extractSalientFacts("   ")).toEqual([]);
  });
});
