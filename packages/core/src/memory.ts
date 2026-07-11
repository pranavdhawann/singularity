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

export type MemoryStatus = MemoryReviewState | "deleted";

export interface MemoryDto {
  id: string;
  workspaceId: string;
  type: MemoryType;
  statement: string;
  confidence: number;
  reviewState: MemoryReviewState;
  pinned: boolean;
  version: number;
  namespaceIds: string[];
  primaryNamespaceId?: string;
  sourceIds: string[];
  contentHash?: string;
  createdAt: string;
  updatedAt: string;
  outdatedAt?: string;
  deletedAt?: string;
}

export interface MemoryNamespaceDto {
  id: string;
  workspaceId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryRevisionDto {
  id: string;
  memoryId: string;
  version: number;
  previous: Record<string, unknown>;
  next: Record<string, unknown>;
  reason: string;
  createdAt: string;
}

export interface MemoryCompactionSourceDto {
  kind: "memory" | "timeline_event";
  id: string;
  contentHash: string;
}

export interface MemoryCompactionDto {
  id: string;
  workspaceId: string;
  summary: string;
  contentHash: string;
  sources: MemoryCompactionSourceDto[];
  invalidatedAt: string | null;
  createdAt: string;
}

export interface MemoryListInput {
  workspaceId: string;
  reviewState?: MemoryReviewState;
  namespaceId?: string;
  cursor?: string;
  limit?: number;
}

export interface CreateMemoryInput {
  workspaceId: string;
  type: MemoryType;
  statement: string;
  confidence: number;
  reviewState: MemoryReviewState;
  sourceIds: string[];
}

export interface MemoryMutationInput {
  expectedVersion: number;
  statement?: string;
  reviewState?: MemoryReviewState;
  pinned?: boolean;
  namespaceIds?: string[];
  primaryNamespaceId?: string | null;
  reason: string;
}

export interface CreateNamespaceInput {
  workspaceId: string;
  name: string;
  parentId?: string | null;
}

export interface CreateCompactionInput {
  workspaceId: string;
  summary: string;
  sources: MemoryCompactionSourceDto[];
}
