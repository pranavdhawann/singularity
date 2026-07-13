import { createId } from "./ids";

export type EventActor = "user" | "assistant" | "system" | "job";

export interface TimelineEventInput {
  workspaceId: string;
  type: string;
  actor: EventActor;
  title: string;
  payload: Record<string, unknown>;
  privacy: Record<string, unknown>;
}

export interface TimelineEvent extends TimelineEventInput {
  id: string;
  createdAt: Date;
}

export function createEvent(input: TimelineEventInput): TimelineEvent {
  return {
    id: createId("evt"),
    createdAt: new Date(),
    ...input,
  };
}
