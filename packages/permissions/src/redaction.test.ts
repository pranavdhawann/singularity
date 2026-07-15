import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "./redaction";

describe("redactSensitiveText", () => {
  it("redacts API-key shaped secrets", () => {
    const result = redactSensitiveText("token sk-1234567890abcdef");

    expect(result.text).toBe("token [REDACTED_SECRET]");
    expect(result.redactions[0]?.kind).toBe("secret");
  });

  it("redacts high-risk PII so it never reaches an external prompt", () => {
    const result = redactSensitiveText("SSN 123-45-6789 card 4111 1111 1111 1111 email a@b.com");

    expect(result.text).not.toMatch(/123-45-6789|4111 1111 1111 1111|a@b\.com/);
    expect(result.text).toContain("[REDACTED_SSN]");
    expect(result.text).toContain("[REDACTED_CREDIT_CARD]");
    expect(result.text).toContain("[REDACTED_EMAIL]");
    const kinds = result.redactions.map((redaction) => redaction.kind).sort();
    expect(kinds).toEqual(["credit_card", "email", "ssn"]);
  });
});
