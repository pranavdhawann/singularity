import {
  decidePermission,
  type PermissionCapability,
  type PermissionDecision,
  type PermissionRule
} from "@future/core";

export interface PermissionEvaluationInput {
  capability: PermissionCapability;
  rules: PermissionRule[];
  workspaceId: string;
  providerIsLocal?: boolean;
  promptPreviewRequired?: boolean;
}

export function evaluatePermission(input: PermissionEvaluationInput): PermissionDecision {
  if (input.capability === "use_external_models" && input.providerIsLocal === true) {
    return { decision: "allow" };
  }

  if (input.capability === "use_external_models" && input.promptPreviewRequired !== false) {
    const explicit = decidePermission({
      capability: input.capability,
      rules: input.rules,
      requestedScope: { workspaceId: input.workspaceId }
    });
    return explicit.decision === "allow" ? explicit : { decision: "needs_approval" };
  }

  return decidePermission({
    capability: input.capability,
    rules: input.rules,
    requestedScope: { workspaceId: input.workspaceId }
  });
}
