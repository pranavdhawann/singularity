import { describe, expect, it } from "vitest";
import { detectRegexEntities } from "./recognizers";

describe("detectRegexEntities", () => {
  it("detects a Luhn-valid credit card as high-risk", () => {
    const e = detectRegexEntities("card 4242 4242 4242 4242 today");
    const card = e.find((x) => x.type === "credit_card");
    expect(card).toBeDefined();
    expect(card!.risk).toBe("high");
    expect(card!.detector).toBe("regex");
  });

  it("ignores a 16-digit number that fails Luhn", () => {
    const e = detectRegexEntities("num 1234 5678 1234 5678");
    expect(e.find((x) => x.type === "credit_card")).toBeUndefined();
  });

  it("detects email and phone as low-risk and SSN as high-risk", () => {
    const e = detectRegexEntities("me@x.com 415-555-1234 ssn 123-45-6789");
    expect(e.find((x) => x.type === "email")?.risk).toBe("low");
    expect(e.find((x) => x.type === "phone")?.risk).toBe("low");
    expect(e.find((x) => x.type === "ssn")?.risk).toBe("high");
  });

  it("returns entity offsets that map back to the source text", () => {
    const text = "reach me@x.com";
    const [entity] = detectRegexEntities(text);
    expect(text.slice(entity!.start, entity!.end)).toBe("me@x.com");
  });
});
