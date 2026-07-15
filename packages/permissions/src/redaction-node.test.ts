import { describe, expect, it } from "vitest";
import { NodeRedactionEngine } from "./redaction-node";

describe("NodeRedactionEngine", () => {
  it("masks entities with stable typed placeholders and reports counts", async () => {
    const engine = new NodeRedactionEngine();
    const result = await engine.redact("email me@x.com or me@x.com");
    expect(result.redacted).toBe("email [EMAIL_1] or [EMAIL_2]");
    expect(result.counts.email).toBe(2);
    expect(result.hasHighRisk).toBe(false);
    expect(result.mlAvailable).toBe(false);
  });

  it("flags high-risk when a credit card is present", async () => {
    const engine = new NodeRedactionEngine();
    const result = await engine.redact("pay 4242 4242 4242 4242");
    expect(result.hasHighRisk).toBe(true);
    expect(result.redacted).toContain("[CREDIT_CARD_1]");
  });

  it("is deterministic for identical input", async () => {
    const engine = new NodeRedactionEngine();
    const a = await engine.redact("me@x.com");
    const b = await engine.redact("me@x.com");
    expect(a.redacted).toBe(b.redacted);
  });

  it("uses an injected ML recognizer when policy.useMl is true", async () => {
    const engine = new NodeRedactionEngine({
      available: true,
      detect: async () => [{ type: "person", start: 0, end: 3, risk: "low", detector: "ml" }],
    });
    const result = await engine.redact("Ada lives here", { useMl: true });
    expect(result.mlAvailable).toBe(true);
    expect(result.counts.person).toBe(1);
    expect(result.redacted.startsWith("[PERSON_1]")).toBe(true);
  });
});
