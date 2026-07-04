import type { MemoryType } from "@future/core";

export interface CandidateMemory {
  type: MemoryType;
  statement: string;
  confidence: number;
}

export function extractCandidateMemories(text: string): CandidateMemory[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  return [
    {
      type: "summary",
      statement: trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed,
      confidence: 0.6
    }
  ];
}
