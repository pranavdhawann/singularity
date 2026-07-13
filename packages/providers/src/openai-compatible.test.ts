import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { OpenAiCompatibleProvider, OpenAiCompatibleProviderError } from "./openai-compatible";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("OpenAiCompatibleProvider", () => {
  it("streams SSE deltas with authorization and the abort signal", async () => {
    let receivedAuthorization = "";
    let receivedBody = "";
    const server = createServer((request, response) => {
      receivedAuthorization = String(request.headers.authorization ?? "");
      request.on("data", (chunk) => {
        receivedBody += chunk.toString();
      });
      request.on("end", () => {
        response.writeHead(200, { "content-type": "text/event-stream" });
        response.write('data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n');
        response.write('data: {"choices":[{"delta":{"content":"Future"}}]}\n\n');
        response.end("data: [DONE]\n\n");
      });
    });
    servers.push(server);
    const baseUrl = await listen(server);
    const provider = new OpenAiCompatibleProvider({
      id: "external",
      baseUrl,
      apiKey: "test-secret",
      models: [{ id: "model-1", displayName: "Model 1", contextWindow: 8192 }],
    });

    const chunks: string[] = [];
    for await (const chunk of provider.streamText({ prompt: "safe prompt", model: "model-1" })) {
      chunks.push(chunk.text);
    }

    expect(chunks).toEqual(["Hello ", "Future"]);
    expect(receivedAuthorization).toBe("Bearer test-secret");
    expect(JSON.parse(receivedBody)).toMatchObject({ stream: true, model: "model-1" });
  });

  it("returns a safe error without response body, prompt, or secret", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(401, { "content-type": "text/plain" });
      response.end("upstream-body-marker");
    });
    servers.push(server);
    const provider = new OpenAiCompatibleProvider({
      id: "external",
      baseUrl: await listen(server),
      apiKey: "secret-marker",
      models: [{ id: "model-1", displayName: "Model 1", contextWindow: 8192 }],
    });

    let error: unknown;
    try {
      for await (const _chunk of provider.streamText({ prompt: "prompt-marker", model: "model-1" })) {
        // The server never yields a successful chunk.
      }
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(OpenAiCompatibleProviderError);
    expect(error).toMatchObject({ code: "request_failed" });
    expect((error as Error).message).not.toMatch(/upstream-body-marker|prompt-marker|secret-marker/);
  });
});

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not listen");
  return `http://127.0.0.1:${address.port}/v1`;
}
