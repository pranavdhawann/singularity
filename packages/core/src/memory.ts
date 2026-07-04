export type MemoryType = "fact" | "episode" | "procedure" | "decision" | "task" | "summary";

export type MemoryReviewState = "proposed" | "approved" | "rejected" | "outdated";

export interface MemoryRecord {
  id: string;
  workspaceId: string;
  type: MemoryType;
  statement: string;
  confidence: number;
  reviewState: MemoryReviewState;
  pinned: boolean;
  sourceIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
