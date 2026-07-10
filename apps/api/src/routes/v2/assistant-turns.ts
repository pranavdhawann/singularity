import type { CreateAssistantTurnInput } from "@future/core";
import { AssistantTurnConflictError } from "@future/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { ApiDependencies } from "../../server/dependencies";
import { sendApiError } from "../../server/api-errors";
import { AssistantServiceError } from "../../services/assistant-service";

interface TurnParams { id: string }

export async function registerV2AssistantTurnRoutes(
  server: FastifyInstance,
  deps: ApiDependencies
): Promise<void> {
  server.post<{ Body: CreateAssistantTurnInput }>(
    "/api/v2/assistant-turns",
    {
      schema: {
        body: {
          type: "object",
          required: ["workspaceId", "modelProfileId", "idempotencyKey", "message"],
          additionalProperties: false,
          properties: {
            workspaceId: { type: "string", minLength: 1 },
            modelProfileId: { type: "string", minLength: 1 },
            idempotencyKey: { type: "string", minLength: 1, maxLength: 200 },
            message: { type: "string", minLength: 1, maxLength: 20000 }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const result = deps.assistantService.createTurn(request.body);
        return reply.code(result.replayed ? 200 : 201).send(result);
      } catch (error) {
        if (error instanceof AssistantTurnConflictError) {
          return sendApiError(reply, 409, "conflict", "Idempotency key already used");
        }
        throw error;
      }
    }
  );

  server.get<{ Params: TurnParams }>("/api/v2/assistant-turns/:id", async (request, reply) => {
    const turn = deps.assistantService.getTurn(request.params.id);
    return turn ?? sendApiError(reply, 404, "not_found", "Assistant turn not found");
  });

  server.post<{ Params: TurnParams }>(
    "/api/v2/assistant-turns/:id/stream",
    { schema: { body: { type: "null" } } },
    async (request, reply) => {
      const turn = deps.assistantService.getTurn(request.params.id);
      if (!turn) return sendApiError(reply, 404, "not_found", "Assistant turn not found");
      if (turn.state !== "queued") {
        return sendApiError(reply, 409, "conflict", "Assistant turn is not streamable");
      }

      reply.hijack();
      reply.raw.statusCode = 200;
      reply.raw.setHeader("content-type", "text/event-stream; charset=utf-8");
      reply.raw.setHeader("cache-control", "no-cache");
      reply.raw.setHeader("connection", "keep-alive");
      request.raw.once("aborted", () => {
        try { deps.assistantService.cancelTurn(request.params.id); } catch { /* terminal */ }
      });
      try {
        for await (const frame of deps.assistantService.streamTurn(request.params.id)) {
          writeSse(reply, frame.type, frame);
        }
      } finally {
        reply.raw.end();
      }
    }
  );

  server.post<{ Params: TurnParams }>(
    "/api/v2/assistant-turns/:id/cancel",
    { schema: { body: { type: "null" } } },
    async (request, reply) => {
      try {
        return deps.assistantService.cancelTurn(request.params.id);
      } catch (error) {
        return mapServiceError(reply, error);
      }
    }
  );
}

function writeSse(reply: FastifyReply, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function mapServiceError(reply: FastifyReply, error: unknown) {
  if (!(error instanceof AssistantServiceError)) throw error;
  if (error.code === "turn_not_found") {
    return sendApiError(reply, 404, "not_found", "Assistant turn not found");
  }
  return sendApiError(reply, 409, "conflict", "Assistant turn cannot be changed");
}
