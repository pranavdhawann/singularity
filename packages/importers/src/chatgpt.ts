import { hashText } from "./hash";
import type { ImportParseResult } from "./types";

interface ChatGptExport {
  conversations?: ChatGptConversation[];
}

interface ChatGptConversation {
  title?: string;
  mapping?: Record<string, ChatGptMappingNode>;
}

interface ChatGptMappingNode {
  message?: {
    author?: { role?: string };
    content?: { parts?: unknown[] };
    create_time?: number;
  };
}

export function parseChatGptExport(input: ChatGptExport | ChatGptConversation[]): ImportParseResult {
  const conversations = Array.isArray(input) ? input : (input.conversations ?? []);

  return {
    documents: conversations.map((conversation, index) => {
      const title = conversation.title?.trim() || `ChatGPT conversation ${index + 1}`;
      const text = flattenConversation(conversation);

      return {
        title,
        sourceUri: `chatgpt-export://${encodeURIComponent(title)}`,
        mediaType: "application/vnd.openai.chatgpt+json",
        text,
        hash: hashText(text),
        metadata: {
          source: "chatgpt",
          conversationIndex: index
        }
      };
    })
  };
}

function flattenConversation(conversation: ChatGptConversation): string {
  return Object.values(conversation.mapping ?? {})
    .map((node) => {
      const message = node.message;
      const parts = message?.content?.parts ?? [];
      const text = parts.map(partToText).filter(Boolean).join("\n").trim();
      if (!text) return "";

      const role = message?.author?.role ?? "unknown";
      return `${role}: ${text}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function partToText(part: unknown): string {
  if (typeof part === "string") return part;
  if (part && typeof part === "object" && "text" in part) {
    const value = (part as { text?: unknown }).text;
    return typeof value === "string" ? value : "";
  }
  return "";
}
