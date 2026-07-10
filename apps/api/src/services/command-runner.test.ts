import { afterEach, describe, expect, it, vi } from "vitest";
import { runCommand } from "./command-runner";

describe("runCommand", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("routes local ollama commands through the ollama adapter", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
      return new Response(JSON.stringify({ response: "Local Ollama response" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetch);

    const result = await runCommand({
      workspaceId: "w_demo",
      command: "ask_with_memory",
      input: "Use the local model",
      providerId: "ollama"
    });

    expect(result.responseText).toBe("Local Ollama response");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/generate",
      expect.objectContaining({ method: "POST" })
    );

    const requestInit = fetch.mock.calls[0]?.[1];
    if (!requestInit || typeof requestInit.body !== "string") {
      throw new Error("Expected Ollama request body to be serialized JSON");
    }

    expect(JSON.parse(requestInit.body)).toEqual(
      expect.objectContaining({
        model: "llama3.2",
        stream: true
      })
    );
  });
});
