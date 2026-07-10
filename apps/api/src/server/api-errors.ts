import { apiError, type ApiErrorCode } from "@future/core";
import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";

export function sendApiError(
  reply: FastifyReply,
  status: number,
  code: ApiErrorCode,
  message: string
) {
  return reply.code(status).send(apiError(code, message, reply.request.id));
}

export function registerApiErrorHandler(server: FastifyInstance): void {
  server.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply
        .code(400)
        .send(apiError("validation_error", "Invalid request", request.id));
    }

    request.log.error({ err: error }, "request failed");
    return reply.code(500).send(apiError("internal_error", "Request failed", request.id));
  });
}
