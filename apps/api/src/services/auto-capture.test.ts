import { describe, expect, it } from "vitest";
import { selectNewFacts } from "./auto-capture";

describe("selectNewFacts", () => {
  it("drops facts that already exist as memory statements (case-insensitive)", () => {
    const result = selectNewFacts(["I like tea.", "My name is Ada."], ["i like tea."]);
    expect(result).toEqual(["My name is Ada."]);
  });

  it("returns all facts when none exist yet", () => {
    expect(selectNewFacts(["I like tea."], [])).toEqual(["I like tea."]);
  });

  it("normalizes trailing whitespace/period differences", () => {
    expect(selectNewFacts(["I like tea"], ["I like tea."])).toEqual([]);
  });
});
