import type { TimelineEvent } from "./events";

export type AssistantTurnState =
  "queued" | "building_context" | "awaiting_approval" | "running" | "completed" | "failed" | "cancelled";

export interface SourceReference {
  kind: "memory" | "document_chunk" | "timeline_event" | "compaction";
  id: string;
  workspaceId: string;
  title: string;
  contentHash: string;
  range?: { start: number; end: number };
}

export interface CreateAssistantTurnInput {
  workspaceId: string;
  modelProfileId: string;
  idempotencyKey: string;
  message: string;
}

export interface AssistantTurnDto {
  id: string;
  workspaceId: string;
  modelProfileId: string;
  idempotencyKey: string;
  state: AssistantTurnState;
  userEventId: string;
  contextPackId?: string;
  modelCallId?: string;
  assistantEventId?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEventDto {
  id: string;
  workspaceId: string;
  type: string;
  actor: TimelineEvent["actor"];
  title: string;
  payload: Record<string, unknown>;
  privacy: Record<string, unknown>;
  createdAt: string;
  citations?: SourceReference[];
}

export interface ContextPackInspectionItem {
  source: SourceReference;
  text: string;
  tokenCount: number;
  score: number;
  retrieval?: RetrievalBreakdown;
  compactionSources?: SourceReference[];
}

export interface RetrievalBreakdown {
  lexicalScore?: number;
  vectorScore?: number;
  finalScore: number;
  reasons: string[];
}

export interface ContextPackRetrievalMetadata {
  mode: "lexical" | "hybrid";
  fallbackReason: string | null;
}

export interface ContextPackInspection {
  id: string;
  workspaceId: string;
  turnId: string;
  modelProfileId: string;
  providerId: string;
  model: string;
  items: ContextPackInspectionItem[];
  estimatedTokens: number;
  redactionCount: number;
  retrieval?: ContextPackRetrievalMetadata;
  createdAt: string;
}

export type AssistantStreamFrame =
  | { type: "started"; turn: AssistantTurnDto }
  | { type: "context"; contextPackId: string; sourceCount: number; redactionCounts: Record<string, number> }
  | { type: "approval_required"; turnId: string; previewId: string }
  | { type: "delta"; text: string }
  | {
      type: "completed";
      turn: AssistantTurnDto;
      event: TimelineEventDto;
      citations: SourceReference[];
    }
  | { type: "cancelled"; turn: AssistantTurnDto }
  | { type: "failed"; turn: AssistantTurnDto; message: string };

export function serializeTimelineEvent(event: TimelineEvent): TimelineEventDto {
  return {
    ...event,
    createdAt: event.createdAt.toISOString(),
  };
}

export function sourceReferenceKey(source: SourceReference): string {
  const range = source.range ? `:${source.range.start}-${source.range.end}` : "";
  return `${source.kind}:${source.id}:${source.contentHash}${range}`;
}
