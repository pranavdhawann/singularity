import { createServer } from "node:http";

const port = Number.parseInt(process.env.PHASE4_OPENAI_PORT ?? "4180", 10);
let callCount = 0;
const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.method === "GET" && request.url === "/calls") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ callCount }));
    return;
  }
  if (request.method === "GET" && request.url === "/v1/models") {
    if (request.headers.authorization !== "Bearer phase4-test-secret") {
      response.writeHead(401).end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "phase4-model" }] }));
    return;
  }
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
    response.writeHead(404).end();
    return;
  }
  if (request.headers.authorization !== "Bearer phase4-test-secret") {
    response.writeHead(401).end();
    return;
  }
  let body = "";
  request.on("data", (chunk) => {
    body += chunk.toString();
  });
  request.on("end", () => {
    callCount += 1;
    const parsed = JSON.parse(body) as { stream?: boolean };
    if (parsed.stream !== true) {
      response.writeHead(400).end();
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    response.write('data: {"choices":[{"delta":{"content":"Phase 4 "}}]}\n\n');
    response.write('data: {"choices":[{"delta":{"content":"external answer"}}]}\n\n');
    response.end("data: [DONE]\n\n");
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Phase 4 OpenAI-compatible test server listening on http://127.0.0.1:${port}`);
});
