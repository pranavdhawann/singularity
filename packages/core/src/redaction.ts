export type RedactionRisk = "low" | "high";
export type RedactionDetector = "regex" | "ml";

export interface RedactionEntity {
  type: string;
  start: number;
  end: number;
  risk: RedactionRisk;
  detector: RedactionDetector;
}

export interface RedactionResult {
  redacted: string;
  entities: RedactionEntity[];
  counts: Record<string, number>;
  hasHighRisk: boolean;
  mlAvailable: boolean;
}

export interface RedactionPolicy {
  useMl: boolean;
}
