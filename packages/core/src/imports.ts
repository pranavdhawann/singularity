export type ImportJobState =
  | "queued"
  | "parsing"
  | "indexing"
  | "embedding"
  | "completed"
  | "failed";

export interface ImportJobDto {
  id: string;
  importId: string;
  workspaceId: string;
  filename: string;
  mediaType: string;
  byteSize: number;
  state: ImportJobState;
  documentIndex: number;
  nextChunkIndex: number;
  documentCount: number;
  completedDocumentCount: number;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}
