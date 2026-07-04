import { createEvent, type TimelineEvent } from "@future/core";
import { MockProvider, ProviderRegistry } from "@future/providers";
import { buildContextPack, type ContextCandidate } from "@future/retrieval";

export interface RunCommandInput {
  workspaceId: string;
  command: "ask_with_memory";
  input: string;
  providerId: string;
  memories?: ContextCandidate[];
}

export interface RunCommandResult {
  events: TimelineEvent[];
  responseText: string;
  contextPackId: string;
}

export async function runCommand(input: RunCommandInput): Promise<RunCommandResult> {
  const providers = new ProviderRegistry([new MockProvider()]);
  const provider = providers.get(input.providerId);
  const contextPack = buildContextPack({
    workspaceId: input.workspaceId,
    command: input.input,
    budgetTokens: 1200,
    memories: input.memories ?? [],
    chunks: [],
    recentEvents: []
  });

  let responseText = "";
  for await (const chunk of provider.streamText({ prompt: buildPrompt(input.input, contextPack.items), model: "mock" })) {
    responseText += chunk.text;
  }

  const events = [
    createEvent({
      workspaceId: input.workspaceId,
      type: "command.started",
      actor: "user",
      title: "Ask with memory",
      payload: { command: input.command, input: input.input },
      privacy: { labels: ["local"] }
    }),
    createEvent({
      workspaceId: input.workspaceId,
      type: "context_pack.created",
      actor: "system",
      title: "Created context pack",
      payload: {
        contextPackId: contextPack.id,
        itemIds: contextPack.items.map((item) => item.id),
        estimatedTokens: contextPack.estimatedTokens
      },
      privacy: { labels: ["local"] }
    }),
    createEvent({
      workspaceId: input.workspaceId,
      type: "model_call.completed",
      actor: "assistant",
      title: "Mock model call completed",
      payload: { providerId: input.providerId, outputCharacters: responseText.length },
      privacy: { labels: ["local"] }
    }),
    createEvent({
      workspaceId: input.workspaceId,
      type: "assistant.response.created",
      actor: "assistant",
      title: "Assistant response",
      payload: { responseText, contextPackId: contextPack.id },
      privacy: { labels: ["local"] }
    })
  ];

  return {
    events,
    responseText,
    contextPackId: contextPack.id
  };
}

function buildPrompt(command: string, items: ContextCandidate[]): string {
  const context = items.map((item) => `- ${item.text}`).join("\n");
  return context ? `${command}\n\nContext:\n${context}` : command;
}
