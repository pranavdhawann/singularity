import type { RedactionRisk } from "@future/core";

const HIGH_RISK = new Set<string>([
  "credit_card",
  "ssn",
  "iban",
  "bank_account",
  "passport",
  "secret",
  "private_key",
  "credential_path",
  "medical_record",
]);

export function riskFor(type: string): RedactionRisk {
  return HIGH_RISK.has(type) ? "high" : "low";
}
