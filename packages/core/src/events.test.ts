import { describe, expect, it } from "vitest";
import { createEvent } from "./events";

describe("createEvent", () => {
  it("creates a timeline event with a stable workspace and type", () => {
    const event = createEvent({
      workspaceId: "w_demo",
      type: "workspace.created",
      actor: "user",
      title: "Created Demo",
      payload: { name: "Demo" },
      privacy: { labels: ["local"] },
    });

    expect(event.id).toMatch(/^evt_/);
    expect(event.workspaceId).toBe("w_demo");
    expect(event.type).toBe("workspace.created");
    expect(event.createdAt).toBeInstanceOf(Date);
  });
});
