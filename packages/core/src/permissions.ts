export type PermissionCapability =
  | "read_files"
  | "write_files"
  | "run_commands"
  | "browse_web"
  | "call_apis"
  | "write_memory"
  | "use_external_models";

export type PermissionState =
  | "deny"
  | "ask_every_time"
  | "allow_for_session"
  | "allow_for_workspace"
  | "always_allow";

export interface PermissionRule {
  capability: PermissionCapability;
  state: PermissionState;
  workspaceId?: string;
  expiresAt?: Date;
}

export interface PermissionDecisionInput {
  capability: PermissionCapability;
  rules: PermissionRule[];
  requestedScope: { workspaceId: string };
}

export interface PermissionDecision {
  decision: "allow" | "deny" | "needs_approval";
  matchedRule?: PermissionRule;
}

export function decidePermission(input: PermissionDecisionInput): PermissionDecision {
  const matchingRule = input.rules.find((rule) => {
    if (rule.capability !== input.capability) return false;
    if (rule.workspaceId && rule.workspaceId !== input.requestedScope.workspaceId) return false;
    if (rule.expiresAt && rule.expiresAt.getTime() < Date.now()) return false;
    return true;
  });

  if (!matchingRule) {
    return input.capability === "use_external_models"
      ? { decision: "needs_approval" }
      : { decision: "deny" };
  }

  if (matchingRule.state === "deny") {
    return { decision: "deny", matchedRule: matchingRule };
  }

  if (matchingRule.state === "ask_every_time") {
    return { decision: "needs_approval", matchedRule: matchingRule };
  }

  return { decision: "allow", matchedRule: matchingRule };
}
