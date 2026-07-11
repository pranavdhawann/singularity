import { createId, sourceReferenceKey, type RetrievalBreakdown, type SourceReference } from "@future/core";

export interface ContextCandidate {
  source: SourceReference;
  text: string;
  tokenCount: number;
  score: number;
  retrieval?: RetrievalBreakdown;
  compactionSources?: SourceReference[];
}

export interface BuildContextPackInput {
  command: string;
  budgetTokens: number;
  reservedTokens?: number;
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
  const sorted = [...input.memories, ...input.chunks, ...input.recentEvents].sort(
    (a, b) => b.score - a.score || sourceReferenceKey(a.source).localeCompare(sourceReferenceKey(b.source))
  );
  const candidates: BuiltContextPackItem[] = [];
  for (const candidate of sorted) {
    if (candidates.some((current) => isDuplicate(current, candidate))) continue;
    candidates.push(candidate);
  }

  const items: BuiltContextPackItem[] = [];
  let estimatedTokens = estimateTokenCount(input.command) + (input.reservedTokens ?? 0);

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

function isDuplicate(a: BuiltContextPackItem, b: BuiltContextPackItem): boolean {
  if (a.source.contentHash === b.source.contentHash) return true;
  if (a.source.kind !== b.source.kind || a.source.id !== b.source.id) return false;
  if (!a.source.range || !b.source.range) return sourceReferenceKey(a.source) === sourceReferenceKey(b.source);
  return a.source.range.start < b.source.range.end && b.source.range.start < a.source.range.end;
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3));
}
