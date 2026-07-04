export interface ContextPackItem {
  id: string;
  kind: "memory" | "document_chunk" | "timeline_event" | "permission_state";
  text: string;
  tokenCount: number;
  score: number;
}

export interface ContextPack {
  id: string;
  workspaceId: string;
  command: string;
  items: ContextPackItem[];
  estimatedTokens: number;
  createdAt: Date;
}
