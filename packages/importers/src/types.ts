export interface ImportedDocument {
  title: string;
  sourceUri: string;
  mediaType: string;
  text: string;
  hash: string;
  metadata: Record<string, unknown>;
}

export interface ImportParseResult {
  documents: ImportedDocument[];
}

export interface DocumentChunk {
  chunkIndex: number;
  text: string;
  tokenCount: number;
  sourceRange: {
    start: number;
    end: number;
  };
}
