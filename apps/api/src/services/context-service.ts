import { createHash } from "node:crypto";
import { type ContextPackInspection, type ModelProfile } from "@future/core";
import {
  SearchRepository,
  type CompactionRepository,
  type ContextPackRepository,
  type EmbeddingRepository,
  type EventRepository,
  type SqliteDatabase,
  type UnifiedSearchCandidate
} from "@future/db";
import {
  EmbeddingAdapterError,
  buildContextPack,
  rankHybridCandidates,
  type EmbeddingAdapter,
  type HybridRetrievalCandidate
} from "@future/retrieval";

interface EmbeddingRuntimeResolver {
  getEmbeddingRuntime(profile: ModelProfile): { adapter: EmbeddingAdapter; model: string } | undefined;
}

interface ContextServiceDependencies {
  db: SqliteDatabase;
  events: EventRepository;
  contextPacks: ContextPackRepository;
  embeddings?: EmbeddingRepository;
  compactions?: CompactionRepository;
  embeddingResolver?: EmbeddingRuntimeResolver;
}

export interface BuildTurnContextInput {
  turnId: string; workspaceId: string; userEventId: string; query: string;
  providerId: string; profile: ModelProfile;
}

export class ContextService {
  private readonly search: SearchRepository;
  constructor(private readonly dependencies: ContextServiceDependencies) {
    this.search = new SearchRepository(dependencies.db);
  }

  async buildForTurn(input: BuildTurnContextInput): Promise<ContextPackInspection> {
    const candidates = this.collectCandidates(input);
    const vector = await this.addVectorScores(input.profile, input.query, candidates);
    const ranked = rankHybridCandidates({ workspaceId: input.workspaceId, candidates: vector.candidates,
      suppressedSourceKeys: this.dependencies.compactions?.activeSourceKeys(input.workspaceId) ?? [] });
    const built = buildContextPack({ workspaceId: input.workspaceId, command: input.query,
      budgetTokens: Math.max(256, Math.min(input.profile.contextWindow - 512, 4096)),
      reservedTokens: 256,
      memories: ranked.filter((item) => item.source.kind === "memory" || item.source.kind === "compaction"),
      chunks: ranked.filter((item) => item.source.kind === "document_chunk"),
      recentEvents: ranked.filter((item) => item.source.kind === "timeline_event") });
    const pack: ContextPackInspection = {
      id: built.id, workspaceId: built.workspaceId, turnId: input.turnId,
      modelProfileId: input.profile.id, providerId: input.providerId, model: input.profile.model,
      items: built.items, estimatedTokens: built.estimatedTokens, redactionCount: 0,
      retrieval: { mode: vector.mode, fallbackReason: vector.fallbackReason },
      createdAt: built.createdAt.toISOString()
    };
    this.dependencies.contextPacks.create(pack);
    return pack;
  }

  private collectCandidates(input: BuildTurnContextInput): HybridRetrievalCandidate[] {
    const lexical = this.search.search({ workspaceId: input.workspaceId, query: input.query, limit: 40 })
      .filter((candidate) => !(candidate.kind === "timeline_event" && candidate.id === input.userEventId));
    const combined = [...lexical, ...this.loadPinned(input.workspaceId), ...this.loadRecent(input.workspaceId, input.userEventId)];
    const unique = new Map<string, UnifiedSearchCandidate>();
    for (const candidate of combined) {
      const key = `${candidate.kind}:${candidate.id}:${candidate.contentHash}`;
      const current = unique.get(key);
      unique.set(key, current ? { ...current, ...candidate,
        lexicalScore: Math.max(current.lexicalScore, candidate.lexicalScore),
        ...((current.pinned || candidate.pinned) ? { pinned: true } : {}) } : candidate);
    }
    return [...unique.values()];
  }

  private async addVectorScores(
    profile: ModelProfile,
    query: string,
    candidates: HybridRetrievalCandidate[]
  ): Promise<{ candidates: HybridRetrievalCandidate[]; mode: "lexical" | "hybrid"; fallbackReason: string | null }> {
    const runtime = this.dependencies.embeddingResolver?.getEmbeddingRuntime(profile);
    if (!runtime || candidates.length === 0) return { candidates, mode: "lexical", fallbackReason: "not_configured" };
    try {
      const result = await runtime.adapter.embed({ model: runtime.model, texts: [query, ...candidates.map((item) => item.text)] });
      if (!result.available) return { candidates, mode: "lexical", fallbackReason: "adapter_unavailable" };
      const [queryVector, ...vectors] = result.vectors;
      if (!queryVector) return { candidates, mode: "lexical", fallbackReason: "invalid_response" };
      const scored = candidates.map((candidate, index) => {
        const vector = vectors[index]!;
        this.dependencies.embeddings?.upsert({ workspaceId: candidate.workspaceId, sourceKind: candidate.kind,
          sourceId: candidate.id, contentHash: candidate.contentHash, adapter: runtime.adapter.id,
          model: runtime.model, vector });
        return { ...candidate, vectorScore: (cosine(queryVector, vector) + 1) / 2 };
      });
      return { candidates: scored, mode: "hybrid", fallbackReason: null };
    } catch (error) {
      return { candidates, mode: "lexical",
        fallbackReason: error instanceof EmbeddingAdapterError ? error.code : "embedding_unavailable" };
    }
  }

  private loadPinned(workspaceId: string): UnifiedSearchCandidate[] {
    interface Row { id: string; statement: string; confidence: number; content_hash: string; created_at: string }
    return this.dependencies.db.prepare<{ workspaceId: string }, Row>(
      `SELECT id, statement, confidence, content_hash, created_at FROM memories
       WHERE workspace_id = @workspaceId AND review_state = 'approved' AND pinned = 1
         AND outdated_at IS NULL AND deleted_at IS NULL LIMIT 12`
    ).all({ workspaceId }).map((row) => ({ kind: "memory", id: row.id, workspaceId,
      title: "Pinned memory", text: row.statement, tokenCount: estimateTokens(row.statement),
      contentHash: row.content_hash || hash(row.statement), lexicalScore: 0,
      confidence: row.confidence, pinned: true, createdAt: row.created_at }));
  }

  private loadRecent(workspaceId: string, currentUserEventId: string): UnifiedSearchCandidate[] {
    return this.dependencies.events.list({ workspaceId, limit: 12, order: "desc" })
      .filter((event) => event.id !== currentUserEventId).flatMap((event) => {
        const text = event.type === "user.message.created" ? event.payload.text
          : event.type === "assistant.response.created" ? event.payload.responseText : undefined;
        return typeof text === "string" && text.trim() ? [{ kind: "timeline_event" as const,
          id: event.id, workspaceId, title: event.title, text, tokenCount: estimateTokens(text),
          contentHash: hash(text), lexicalScore: 0, createdAt: event.createdAt.toISOString() }] : [];
      });
  }
}

function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) throw new EmbeddingAdapterError("invalid_response");
  let dot = 0; let normA = 0; let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index]! * b[index]!; normA += a[index]! ** 2; normB += b[index]! ** 2;
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}
function hash(text: string): string { return createHash("sha256").update(text).digest("hex"); }
function estimateTokens(text: string): number { return Math.max(1, Math.ceil(text.trim().split(/\s+/).length * 1.3)); }
