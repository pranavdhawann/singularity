import { describe, expect, it } from "vitest";
import { runCommand } from "./command-runner";

describe("runCommand", () => {
  it("creates timeline records for ask-with-memory command", async () => {
    const result = await runCommand({
      workspaceId: "w_demo",
      command: "ask_with_memory",
      input: "What should we build first?",
      providerId: "mock"
    });

    expect(result.events.map((event) => event.type)).toEqual([
      "command.started",
      "context_pack.created",
      "model_call.completed",
      "assistant.response.created"
    ]);
  });
});
