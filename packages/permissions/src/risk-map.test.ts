import { describe, expect, it } from "vitest";
import { riskFor } from "./risk-map";

describe("riskFor", () => {
  it("classifies financial, government, medical, and credential types as high", () => {
    for (const t of ["credit_card", "ssn", "iban", "secret", "private_key", "medical_record"]) {
      expect(riskFor(t)).toBe("high");
    }
  });
  it("classifies contact/identity types as low", () => {
    for (const t of ["email", "phone", "person", "address", "ip", "url"]) {
      expect(riskFor(t)).toBe("low");
    }
  });
  it("defaults unknown types to low", () => {
    expect(riskFor("mystery")).toBe("low");
  });
});
