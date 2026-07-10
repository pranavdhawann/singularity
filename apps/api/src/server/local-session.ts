import { apiError } from "@future/core";
import type { FastifyInstance } from "fastify";

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function registerLocalSession(
  server: FastifyInstance,
  token: string,
  allowedOrigins: readonly string[]
): Promise<void> {
  server.get("/api/v2/session", async () => ({ token }));

  server.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/v2/") || !mutationMethods.has(request.method)) {
      return;
    }

    const origin = request.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      return reply
        .code(403)
        .send(apiError("forbidden", "Origin not allowed", request.id));
    }

    if (request.headers["x-future-session"] === token) {
      return;
    }

    return reply
      .code(401)
      .send(apiError("unauthorized", "Local session required", request.id));
  });
}
