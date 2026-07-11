import { createHash } from "node:crypto";
import type { SqliteDatabase } from "../connection";

export type SearchSourceKind = "document_chunk" | "memory" | "timeline_event";
export interface UnifiedSearchCandidate {
  kind: SearchSourceKind; id: string; workspaceId: string; title: string; text: string;
  tokenCount: number; contentHash: string; lexicalScore: number;
  sourceRange?: { start: number; end: number };
  confidence?: number; pinned?: boolean; createdAt?: string;
}
export interface UnifiedSearchInput { workspaceId: string; query: string; limit?: number }

interface RankedCandidate extends Omit<UnifiedSearchCandidate, "lexicalScore"> { rawScore: number }

export class SearchRepository {
  constructor(private readonly db: SqliteDatabase) {}

  search(input: UnifiedSearchInput): UnifiedSearchCandidate[] {
    const query = sanitizeFtsQuery(input.query);
    if (!query) return [];
    const candidates = [
      ...this.searchDocuments(input.workspaceId, query),
      ...this.searchMemories(input.workspaceId, query),
      ...this.searchEvents(input.workspaceId, query)
    ];
    const max = Math.max(...candidates.map((candidate) => candidate.rawScore), 0);
    return candidates.map(({ rawScore, ...candidate }) => ({
      ...candidate,
      lexicalScore: max > 0 ? rawScore / max : 1
    })).sort((a, b) => b.lexicalScore - a.lexicalScore || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
      .slice(0, input.limit ?? 20);
  }

  private searchDocuments(workspaceId: string, query: string): RankedCandidate[] {
    interface Row { id: string; title: string; text: string; token_count: number; source_range_json: string | null; rank: number }
    return this.db.prepare<{ workspaceId: string; query: string }, Row>(
      `SELECT dc.id, d.title, dc.text, dc.token_count, dc.source_range_json,
        -bm25(document_chunks_fts) AS rank
       FROM document_chunks_fts f
       JOIN document_chunks dc ON dc.id = f.chunk_id
       JOIN documents d ON d.id = dc.document_id
       WHERE document_chunks_fts MATCH @query AND d.workspace_id = @workspaceId`
    ).all({ workspaceId, query }).map((row) => ({
      kind: "document_chunk", id: row.id, workspaceId, title: row.title, text: row.text,
      tokenCount: row.token_count, contentHash: hash(row.text), rawScore: Math.max(row.rank, 0),
      ...(row.source_range_json ? { sourceRange: JSON.parse(row.source_range_json) as { start: number; end: number } } : {})
    }));
  }

  private searchMemories(workspaceId: string, query: string): RankedCandidate[] {
    interface Row { id: string; statement: string; confidence: number; pinned: 0 | 1; content_hash: string; created_at: string; rank: number }
    return this.db.prepare<{ workspaceId: string; query: string }, Row>(
      `SELECT m.id, m.statement, m.confidence, m.pinned, m.content_hash, m.created_at,
        -bm25(memories_fts) AS rank
       FROM memories_fts f JOIN memories m ON m.id = f.memory_id
       WHERE memories_fts MATCH @query AND m.workspace_id = @workspaceId
         AND m.review_state = 'approved' AND m.outdated_at IS NULL AND m.deleted_at IS NULL`
    ).all({ workspaceId, query }).map((row) => ({
      kind: "memory", id: row.id, workspaceId, title: "Approved memory", text: row.statement,
      tokenCount: estimateTokens(row.statement), contentHash: row.content_hash || hash(row.statement),
      confidence: row.confidence, pinned: row.pinned === 1, createdAt: row.created_at,
      rawScore: Math.max(row.rank, 0)
    }));
  }

  private searchEvents(workspaceId: string, query: string): RankedCandidate[] {
    interface Row { id: string; title: string; payload_json: string; created_at: string; rank: number }
    return this.db.prepare<{ workspaceId: string; query: string }, Row>(
      `SELECT e.id, e.title, e.payload_json, e.created_at, -bm25(events_fts) AS rank
       FROM events_fts f JOIN events e ON e.id = f.event_id
       WHERE events_fts MATCH @query AND e.workspace_id = @workspaceId`
    ).all({ workspaceId, query }).flatMap((row) => {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
      const text = typeof payload.text === "string" ? payload.text
        : typeof payload.responseText === "string" ? payload.responseText : undefined;
      return text?.trim() ? [{ kind: "timeline_event" as const, id: row.id, workspaceId,
        title: row.title, text, tokenCount: estimateTokens(text), contentHash: hash(text),
        createdAt: row.created_at, rawScore: Math.max(row.rank, 0) }] : [];
    });
  }
}

export function sanitizeFtsQuery(query: string): string {
  return query.split(/\s+/).map((token) => token.replace(/[^a-zA-Z0-9_]/g, ""))
    .filter(Boolean).join(" ");
}
function hash(text: string): string { return createHash("sha256").update(text).digest("hex"); }
function estimateTokens(text: string): number { return Math.max(1, Math.ceil(text.trim().split(/\s+/).length * 1.3)); }
