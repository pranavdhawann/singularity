import { createHash } from "node:crypto";
import {
  type ContextPackInspection,
  type ModelProfile,
  type SourceReference
} from "@future/core";
import type {
  ContextPackRepository,
  EventRepository,
  SqliteDatabase
} from "@future/db";
import {
  buildContextPack,
  searchLexical,
  type ContextCandidate
} from "@future/retrieval";

interface ContextServiceDependencies {
  db: SqliteDatabase;
  events: EventRepository;
  contextPacks: ContextPackRepository;
}

export interface BuildTurnContextInput {
  turnId: string;
  workspaceId: string;
  userEventId: string;
  query: string;
  providerId: string;
  profile: ModelProfile;
}

interface MemoryCandidateRow {
  id: string;
  statement: string;
  confidence: number;
  pinned: 0 | 1;
}

interface DocumentCandidateRow {
  id: string;
  text: string;
  token_count: number;
  title: string;
  hash: string;
}

export class ContextService {
  constructor(private readonly dependencies: ContextServiceDependencies) {}

  buildForTurn(input: BuildTurnContextInput): ContextPackInspection {
    const memories = this.loadMemories(input.workspaceId, input.query);
    const chunks = this.loadDocumentChunks(input.workspaceId, input.query);
    const recentEvents = this.loadRecentEvents(
      input.workspaceId,
      input.userEventId,
      input.query
    );
    const built = buildContextPack({
      workspaceId: input.workspaceId,
      command: input.query,
      budgetTokens: Math.max(256, Math.min(input.profile.contextWindow - 512, 4096)),
      memories,
      chunks,
      recentEvents
    });
    const pack: ContextPackInspection = {
      id: built.id,
      workspaceId: built.workspaceId,
      turnId: input.turnId,
      modelProfileId: input.profile.id,
      providerId: input.providerId,
      model: input.profile.model,
      items: built.items,
      estimatedTokens: built.estimatedTokens,
      redactionCount: 0,
      createdAt: built.createdAt.toISOString()
    };
    this.dependencies.contextPacks.create(pack);
    return pack;
  }

  private loadMemories(workspaceId: string, query: string): ContextCandidate[] {
    return this.dependencies.db.prepare<{ workspaceId: string }, MemoryCandidateRow>(
      `SELECT id, statement, confidence, pinned
       FROM memories
       WHERE workspace_id = @workspaceId
         AND review_state = 'approved'
         AND outdated_at IS NULL
       ORDER BY pinned DESC, confidence DESC
       LIMIT 12`
    ).all({ workspaceId }).map((row) => ({
      source: source("memory", row.id, workspaceId, "Approved memory", row.statement),
      text: row.statement,
      tokenCount: estimateTokenCount(row.statement),
      score: row.confidence * 10 + (row.pinned ? 5 : 0) + keywordOverlap(query, row.statement)
    }));
  }

  private loadDocumentChunks(workspaceId: string, query: string): ContextCandidate[] {
    const load = this.dependencies.db.prepare<{ id: string }, DocumentCandidateRow>(
      `SELECT dc.id, dc.text, dc.token_count, d.title, d.hash
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.id = @id`
    );
    return searchLexical(this.dependencies.db, { workspaceId, query, limit: 12 }).flatMap(
      (result, index) => {
        const row = load.get({ id: result.chunkId });
        if (!row) return [];
        return [{
          source: {
            kind: "document_chunk" as const,
            id: row.id,
            workspaceId,
            title: row.title,
            contentHash: row.hash,
            ...(result.sourceRange ? { range: result.sourceRange } : {})
          },
          text: row.text,
          tokenCount: row.token_count,
          score: 8 - index * 0.1 + keywordOverlap(query, row.text)
        }];
      }
    );
  }

  private loadRecentEvents(
    workspaceId: string,
    currentUserEventId: string,
    query: string
  ): ContextCandidate[] {
    return this.dependencies.events.list({ workspaceId, limit: 20, order: "desc" })
      .filter((event) => event.id !== currentUserEventId)
      .flatMap((event, index) => {
        const text = event.type === "user.message.created"
          ? event.payload.text
          : event.type === "assistant.response.created"
            ? event.payload.responseText
            : undefined;
        if (typeof text !== "string" || !text.trim()) return [];
        return [{
          source: source("timeline_event", event.id, workspaceId, event.title, text),
          text,
          tokenCount: estimateTokenCount(text),
          score: 6 - index * 0.1 + keywordOverlap(query, text)
        }];
      });
  }
}

function source(
  kind: SourceReference["kind"],
  id: string,
  workspaceId: string,
  title: string,
  text: string
): SourceReference {
  return {
    kind,
    id,
    workspaceId,
    title,
    contentHash: createHash("sha256").update(text).digest("hex")
  };
}

function keywordOverlap(query: string, text: string): number {
  const words = new Set(query.toLowerCase().match(/[a-z0-9_]+/g) ?? []);
  const candidateWords = new Set(text.toLowerCase().match(/[a-z0-9_]+/g) ?? []);
  let overlap = 0;
  for (const word of words) if (candidateWords.has(word)) overlap += 1;
  return overlap;
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3));
}
