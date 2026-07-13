export type RedactionKind = "secret" | "email" | "phone" | "private_key" | "credential_path";

export interface Redaction {
  kind: RedactionKind;
  start: number;
  end: number;
  replacement: string;
}

export interface RedactionResult {
  text: string;
  redactions: Redaction[];
}

const redactionPatterns: Array<{ kind: RedactionKind; pattern: RegExp; replacement: string }> = [
  {
    kind: "private_key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: "[REDACTED_PRIVATE_KEY]",
  },
  { kind: "secret", pattern: /\bsk-[A-Za-z0-9_-]{10,}\b/g, replacement: "[REDACTED_SECRET]" },
  { kind: "secret", pattern: /\bBearer\s+[A-Za-z0-9._-]{10,}\b/g, replacement: "Bearer [REDACTED_SECRET]" },
  { kind: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED_EMAIL]" },
  {
    kind: "phone",
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: "[REDACTED_PHONE]",
  },
  {
    kind: "credential_path",
    pattern: /\b[A-Z]:\\[^\s]*(?:\.ssh|credentials|secrets|tokens)[^\s]*/gi,
    replacement: "[REDACTED_PATH]",
  },
];

export function redactSensitiveText(text: string): RedactionResult {
  const redactions: Redaction[] = [];
  let nextText = text;

  for (const { kind, pattern, replacement } of redactionPatterns) {
    nextText = nextText.replace(pattern, (match: string, offset: number) => {
      redactions.push({
        kind,
        start: offset,
        end: offset + match.length,
        replacement,
      });
      return replacement;
    });
  }

  return { text: nextText, redactions };
}
