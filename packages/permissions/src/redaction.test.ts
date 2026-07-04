import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "./redaction";

describe("redactSensitiveText", () => {
  it("redacts API-key shaped secrets", () => {
    const result = redactSensitiveText("token sk-1234567890abcdef");

    expect(result.text).toBe("token [REDACTED_SECRET]");
    expect(result.redactions[0]?.kind).toBe("secret");
  });
});
