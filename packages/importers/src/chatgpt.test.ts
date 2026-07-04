import { describe, expect, it } from "vitest";
import { parseChatGptExport } from "./chatgpt";

describe("parseChatGptExport", () => {
  it("normalizes conversations into source documents", () => {
    const result = parseChatGptExport({
      conversations: [
        {
          title: "Future planning",
          mapping: {
            a: {
              message: {
                author: { role: "user" },
                content: { parts: ["Build Future"] }
              }
            }
          }
        }
      ]
    });

    expect(result.documents[0]?.title).toBe("Future planning");
    expect(result.documents[0]?.text).toContain("Build Future");
    expect(result.documents[0]?.mediaType).toBe("application/vnd.openai.chatgpt+json");
  });
});
