import type { MemoryReviewState } from "@future/core";

export type MemoryAction = "approve" | "reject" | "mark_outdated" | "edit" | "reconfirm";

export interface TransitionMemoryInput {
  reviewState: MemoryReviewState;
  action: MemoryAction;
  actor: "user" | "assistant" | "system";
}

export interface TransitionMemoryResult {
  reviewState: MemoryReviewState;
  revisionReason: string;
}

export function transitionMemory(input: TransitionMemoryInput): TransitionMemoryResult {
  const key = `${input.reviewState}:${input.action}`;
  const nextState = allowedTransitions[key];

  if (!nextState) {
    throw new Error(`Cannot ${input.action} memory in ${input.reviewState} state`);
  }

  return {
    reviewState: nextState,
    revisionReason: `${input.actor} ${reasonByAction[input.action]}`,
  };
}

const allowedTransitions: Record<string, MemoryReviewState> = {
  "proposed:approve": "approved",
  "proposed:reject": "rejected",
  "approved:mark_outdated": "outdated",
  "approved:reject": "rejected",
  "approved:edit": "approved",
  "outdated:reconfirm": "approved",
};

const reasonByAction: Record<MemoryAction, string> = {
  approve: "approved memory",
  reject: "rejected memory",
  mark_outdated: "marked memory outdated",
  edit: "edited memory",
  reconfirm: "reconfirmed memory",
};
