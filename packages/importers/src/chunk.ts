import type { DocumentChunk } from "./types";

export interface ChunkDocumentOptions {
  maxCharacters?: number;
}

export function chunkDocument(text: string, options: ChunkDocumentOptions = {}): DocumentChunk[] {
  const maxCharacters = options.maxCharacters ?? 1200;
  const normalized = text.trim();

  if (!normalized) {
    return [];
  }

  const chunks: DocumentChunk[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const end = Math.min(cursor + maxCharacters, normalized.length);
    const slice = normalized.slice(cursor, end).trim();

    if (slice) {
      chunks.push({
        chunkIndex: chunks.length,
        text: slice,
        tokenCount: estimateTokenCount(slice),
        sourceRange: {
          start: cursor,
          end,
        },
      });
    }

    cursor = end;
  }

  return chunks;
}

export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3));
}
