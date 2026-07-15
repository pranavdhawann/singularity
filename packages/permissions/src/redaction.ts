import { detectRegexEntities } from "./recognizers";

export type RedactionKind = string;

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

/**
 * Deterministic, regex-based redaction used to render the exact prompt shown in
 * (and sent from) the external-approval preview.
 *
 * This delegates to the same recognizer set that classifies redaction risk
 * (`detectRegexEntities`), so every entity that can pause a turn for approval —
 * including high-risk types such as SSNs, credit cards, IBANs, and credential
 * paths — is masked in the approved prompt. Keeping a second, narrower redactor
 * here previously let high-risk PII gate for approval yet still leave in the
 * text that was actually sent to the provider.
 */
export function redactSensitiveText(text: string): RedactionResult {
  const entities = detectRegexEntities(text); // sorted by start
  const redactions: Redaction[] = [];
  let redacted = "";
  let cursor = 0;
  for (const entity of entities) {
    if (entity.start < cursor) continue; // skip overlapping matches
    const replacement = `[REDACTED_${entity.type.toUpperCase()}]`;
    redacted += text.slice(cursor, entity.start) + replacement;
    redactions.push({ kind: entity.type, start: entity.start, end: entity.end, replacement });
    cursor = entity.end;
  }
  redacted += text.slice(cursor);
  return { text: redacted, redactions };
}
