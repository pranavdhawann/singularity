import type { RedactionEntity } from "@future/core";
import { riskFor } from "./risk-map";

interface Recognizer {
  type: string;
  pattern: RegExp;
  validate?(match: string): boolean;
}

function luhnValid(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const RECOGNIZERS: Recognizer[] = [
  {
    type: "private_key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  { type: "secret", pattern: /\bsk-[A-Za-z0-9_-]{10,}\b/g },
  { type: "secret", pattern: /\bBearer\s+[A-Za-z0-9._-]{10,}\b/g },
  { type: "credit_card", pattern: /\b(?:\d[ -]*?){13,19}\b/g, validate: luhnValid },
  { type: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: "iban", pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
  { type: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { type: "phone", pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { type: "ip", pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
];

export function detectRegexEntities(text: string): RedactionEntity[] {
  const entities: RedactionEntity[] = [];
  for (const rec of RECOGNIZERS) {
    rec.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rec.pattern.exec(text)) !== null) {
      if (match[0].length === 0) {
        rec.pattern.lastIndex += 1;
        continue;
      }
      if (rec.validate && !rec.validate(match[0])) continue;
      entities.push({
        type: rec.type,
        start: match.index,
        end: match.index + match[0].length,
        risk: riskFor(rec.type),
        detector: "regex",
      });
    }
  }
  return entities.sort((a, b) => a.start - b.start);
}
