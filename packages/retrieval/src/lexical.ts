import { SearchRepository, type SqliteDatabase, type UnifiedSearchCandidate } from "@future/db";

export interface IndexSearchChunkInput {
  chunkId: string;
  documentId: string;
  title: string;
  text: string;
  chunkIndex: number;
  tokenCount: number;
  workspaceId?: string;
  importId?: string;
  sourceUri?: string;
  mediaType?: string;
  hash?: string;
  sourceRange?: { start: number; end: number };
}

export interface LexicalSearchInput {
  query: string;
  workspaceId?: string;
  limit?: number;
}

export interface LexicalSearchResult {
  chunkId: string;
  documentId: string;
  title: string;
  snippet: string;
  rank: number;
  sourceRange: { start: number; end: number } | null;
}

interface SearchRow {
  chunk_id: string;
  document_id: string;
  title: string;
  snippet: string;
  rank: number;
  source_range_json: string | null;
}

export function indexSearchChunk(db: SqliteDatabase, input: IndexSearchChunkInput): void {
  const now = new Date().toISOString();
  const insert = db.transaction((chunk: IndexSearchChunkInput) => {
    db.prepare(
      `INSERT OR IGNORE INTO documents (
        id,
        workspace_id,
        import_id,
        title,
        source_uri,
        media_type,
        hash,
        text_path,
        created_at
      ) VALUES (
        @documentId,
        @workspaceId,
        @importId,
        @title,
        @sourceUri,
        @mediaType,
        @hash,
        NULL,
        @createdAt
      )`
    ).run({
      documentId: chunk.documentId,
      workspaceId: chunk.workspaceId ?? "w_search",
      importId: chunk.importId ?? null,
      title: chunk.title,
      sourceUri: chunk.sourceUri ?? `memory://${chunk.documentId}`,
      mediaType: chunk.mediaType ?? "text/plain",
      hash: chunk.hash ?? chunk.documentId,
      createdAt: now
    });

    db.prepare(
      `INSERT OR REPLACE INTO document_chunks (
        id,
        document_id,
        chunk_index,
        text,
        token_count,
        source_range_json,
        embedding_status,
        created_at
      ) VALUES (
        @chunkId,
        @documentId,
        @chunkIndex,
        @text,
        @tokenCount,
        @sourceRangeJson,
        'pending',
        @createdAt
      )`
    ).run({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      tokenCount: chunk.tokenCount,
      sourceRangeJson: chunk.sourceRange ? JSON.stringify(chunk.sourceRange) : null,
      createdAt: now
    });

    db.prepare(
      `INSERT OR REPLACE INTO document_chunks_fts (chunk_id, title, text)
       VALUES (@chunkId, @title, @text)`
    ).run({
      chunkId: chunk.chunkId,
      title: chunk.title,
      text: chunk.text
    });
  });

  insert(input);
}

export function searchLexical(db: SqliteDatabase, input: LexicalSearchInput): LexicalSearchResult[] {
  const query = sanitizeFtsQuery(input.query);
  if (!query) return [];

  const whereWorkspace = input.workspaceId ? "AND d.workspace_id = @workspaceId" : "";
  const rows = db
    .prepare<Record<string, string | number>, SearchRow>(
      `SELECT
        f.chunk_id,
        dc.document_id,
        f.title,
        snippet(document_chunks_fts, 2, '', '', '...', 16) AS snippet,
        bm25(document_chunks_fts) AS rank,
        dc.source_range_json
       FROM document_chunks_fts f
       JOIN document_chunks dc ON dc.id = f.chunk_id
       JOIN documents d ON d.id = dc.document_id
       WHERE document_chunks_fts MATCH @query
       ${whereWorkspace}
       ORDER BY rank
       LIMIT @limit`
    )
    .all({
      query,
      workspaceId: input.workspaceId ?? "",
      limit: input.limit ?? 10
    });

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    title: row.title,
    snippet: row.snippet,
    rank: row.rank,
    sourceRange: row.source_range_json
      ? (JSON.parse(row.source_range_json) as { start: number; end: number })
      : null
  }));
}

export function searchAllLexical(
  db: SqliteDatabase,
  input: { workspaceId: string; query: string; limit?: number }
): UnifiedSearchCandidate[] {
  return new SearchRepository(db).search(input);
}

function sanitizeFtsQuery(query: string): string {
  return query
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z0-9_]/g, ""))
    .filter(Boolean)
    .join(" ");
}
