import type { RedactionEntity, RedactionPolicy, RedactionResult } from "@future/core";

export interface MlRecognizer {
  available: boolean;
  detect(text: string): Promise<RedactionEntity[]>;
}

export interface RedactionEngine {
  analyze(text: string, policy?: RedactionPolicy): Promise<RedactionEntity[]>;
  redact(text: string, policy?: RedactionPolicy): Promise<RedactionResult>;
}
