import type { RetrievalBreakdown, SourceReference } from "@future/core";
import type { SearchSourceKind } from "@future/db";
import type { ContextCandidate } from "./context-pack";

export interface HybridRetrievalCandidate {
  kind: SearchSourceKind;
  id: string;
  workspaceId: string;
  title: string;
  text: string;
  tokenCount: number;
  contentHash: string;
  lexicalScore?: number;
  vectorScore?: number;
  confidence?: number;
  pinned?: boolean;
  createdAt?: string;
  sourceRange?: { start: number; end: number };
  compactionSources?: SourceReference[];
}

export interface RankedContextCandidate extends ContextCandidate {
  retrieval: RetrievalBreakdown;
}

export function rankHybridCandidates(input: {
  workspaceId: string;
  candidates: readonly HybridRetrievalCandidate[];
  suppressedSourceKeys?: readonly string[];
  now?: Date;
}): RankedContextCandidate[] {
  const suppressed = new Set(input.suppressedSourceKeys ?? []);
  const ranked = input.candidates.filter((candidate) =>
    candidate.workspaceId === input.workspaceId && !suppressed.has(sourceKey(candidate))
  ).map((candidate) => rank(candidate, input.now ?? new Date()));

  ranked.sort(compareRanked);
  const diverse: RankedContextCandidate[] = [];
  const selected = new Set<string>();
  for (const kind of ["memory", "compaction", "document_chunk", "timeline_event"] as const) {
    const item = ranked.find((candidate) => candidate.source.kind === kind);
    if (item) { diverse.push(item); selected.add(sourceIdentity(item)); }
  }
  for (const item of ranked) if (!selected.has(sourceIdentity(item))) diverse.push(item);
  return diverse;
}

function rank(candidate: HybridRetrievalCandidate, now: Date): RankedContextCandidate {
  const hasVector = candidate.vectorScore !== undefined;
  let score = hasVector
    ? (candidate.lexicalScore ?? 0) * 0.65 + candidate.vectorScore! * 0.35
    : candidate.lexicalScore ?? 0;
  const reasons: string[] = [];
  if ((candidate.lexicalScore ?? 0) > 0) reasons.push("lexical");
  if (hasVector && candidate.vectorScore! > 0) reasons.push("vector");
  if (candidate.kind === "memory" && candidate.confidence !== undefined) {
    score += Math.max(0, Math.min(1, candidate.confidence)) * 0.05;
    reasons.push("confidence");
  }
  if (candidate.pinned) { score += 0.15; reasons.push("pinned"); }
  const quality = candidate.kind === "memory" || candidate.kind === "compaction" ? 0.05
    : candidate.kind === "document_chunk" ? 0.04 : 0.02;
  score += quality; reasons.push("source_quality");
  if (candidate.createdAt) {
    const ageDays = Math.max(0, now.getTime() - new Date(candidate.createdAt).getTime()) / 86_400_000;
    const recency = Math.max(0, 1 - ageDays / 30) * 0.05;
    if (recency > 0) { score += recency; reasons.push("recent"); }
  }
  const finalScore = Math.max(0, Math.min(1, score));
  const source: SourceReference = {
    kind: candidate.kind,
    id: candidate.id,
    workspaceId: candidate.workspaceId,
    title: candidate.title,
    contentHash: candidate.contentHash,
    ...(candidate.sourceRange ? { range: candidate.sourceRange } : {})
  };
  return {
    source,
    text: candidate.text,
    tokenCount: candidate.tokenCount,
    score: finalScore,
    retrieval: {
      ...(candidate.lexicalScore !== undefined ? { lexicalScore: candidate.lexicalScore } : {}),
      ...(candidate.vectorScore !== undefined ? { vectorScore: candidate.vectorScore } : {}),
      finalScore,
      reasons
    },
    ...(candidate.compactionSources ? { compactionSources: candidate.compactionSources } : {})
  };
}

function sourceKey(candidate: HybridRetrievalCandidate): string {
  return `${candidate.kind}:${candidate.id}:${candidate.contentHash}`;
}
function sourceIdentity(candidate: RankedContextCandidate): string {
  return `${candidate.source.kind}:${candidate.source.id}:${candidate.source.contentHash}`;
}
function compareRanked(a: RankedContextCandidate, b: RankedContextCandidate): number {
  return b.score - a.score || sourceIdentity(a).localeCompare(sourceIdentity(b));
}
