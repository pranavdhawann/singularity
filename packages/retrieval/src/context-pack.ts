import { createId, sourceReferenceKey, type SourceReference } from "@future/core";

export interface ContextCandidate {
  source: SourceReference;
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

export type BuiltContextPackItem = ContextCandidate;

export interface BuiltContextPack {
  id: string;
  workspaceId: string;
  command: string;
  items: BuiltContextPackItem[];
  estimatedTokens: number;
  createdAt: Date;
}

export function buildContextPack(input: BuildContextPackInput): BuiltContextPack {
  const deduplicated = new Map<string, BuiltContextPackItem>();
  for (const candidate of [...input.memories, ...input.chunks, ...input.recentEvents]) {
    const key = sourceReferenceKey(candidate.source);
    const current = deduplicated.get(key);
    if (!current || candidate.score > current.score) deduplicated.set(key, candidate);
  }
  const candidates = [...deduplicated.values()].sort(
    (a, b) => b.score - a.score || sourceReferenceKey(a.source).localeCompare(sourceReferenceKey(b.source))
  );

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
