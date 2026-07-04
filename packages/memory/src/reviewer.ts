import type { MemoryType } from "@future/core";

export function requiresMemoryReview(input: {
  type: MemoryType;
  confidence: number;
  containsSensitiveText?: boolean;
}): boolean {
  return (
    input.containsSensitiveText === true ||
    input.confidence < 0.8 ||
    input.type === "fact" ||
    input.type === "procedure"
  );
}
