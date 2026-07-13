import { describe, expect, it } from "vitest";
import { decidePermission } from "./permissions";

describe("decidePermission", () => {
  it("requires approval for external model use by default", () => {
    const result = decidePermission({
      capability: "use_external_models",
      rules: [],
      requestedScope: { workspaceId: "w_demo" },
    });

    expect(result.decision).toBe("needs_approval");
  });
});
