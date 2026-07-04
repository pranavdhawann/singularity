import { createId } from "@future/core";

export interface ContextCandidate {
  id: string;
  text: string;
  tokenCount: number;
  score: number;
}

export interface BuildContextPackInput {
  command: string;
  budgetTokens: number;
  workspaceId?: string;
  memories: ContextCandidate[];
  chunks: ContextCandidate[];
  recentEvents: ContextCandidate[];
}

export interface BuiltContextPackItem extends ContextCandidate {
  kind: "memory" | "document_chunk" | "timeline_event";
}

export interface BuiltContextPack {
  id: string;
  workspaceId: string;
  command: string;
  items: BuiltContextPackItem[];
  estimatedTokens: number;
  createdAt: Date;
}

export function buildContextPack(input: BuildContextPackInput): BuiltContextPack {
  const candidates: BuiltContextPackItem[] = [
    ...input.memories.map((item) => ({ ...item, kind: "memory" as const })),
    ...input.chunks.map((item) => ({ ...item, kind: "document_chunk" as const })),
    ...input.recentEvents.map((item) => ({ ...item, kind: "timeline_event" as const }))
  ].sort((a, b) => b.score - a.score);

  const items: BuiltContextPackItem[] = [];
  let estimatedTokens = estimateTokenCount(input.command);

  for (const candidate of candidates) {
    if (estimatedTokens + candidate.tokenCount > input.budgetTokens) continue;
    items.push(candidate);
    estimatedTokens += candidate.tokenCount;
  }

  return {
    id: createId("ctx"),
    workspaceId: input.workspaceId ?? "w_default",
    command: input.command,
    items,
    estimatedTokens,
    createdAt: new Date()
  };
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3));
}
