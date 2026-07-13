import { apiError, type MemoryListInput, type MemoryMutationInput, type MemoryReviewState } from "@future/core";
import type { CreateMemoryRecordInput } from "@future/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { ApiDependencies } from "../../server/dependencies";
import { sendApiError } from "../../server/api-errors";
import { MemoryServiceError } from "../../services/memory-service";

interface MemoryParams {
  id: string;
}
interface MemoryQuery {
  workspaceId: string;
  reviewState?: MemoryReviewState;
  namespaceId?: string;
  cursor?: string;
  limit?: number;
}
interface DeleteBody {
  expectedVersion: number;
}
interface MemoryDetailQuery {
  includeDeleted?: boolean;
}

const memoryTypes = ["fact", "episode", "procedure", "decision", "task", "summary"];
const reviewStates = ["proposed", "approved", "rejected", "outdated"];

export async function registerV2MemoryRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  server.get<{ Querystring: MemoryQuery }>(
    "/api/v2/memories",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["workspaceId"],
          additionalProperties: false,
          properties: {
            workspaceId: { type: "string", minLength: 1 },
            reviewState: { type: "string", enum: reviewStates },
            namespaceId: { type: "string", minLength: 1 },
            cursor: { type: "string", minLength: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (request) => {
      const input: MemoryListInput = {
        workspaceId: request.query.workspaceId,
        ...(request.query.reviewState ? { reviewState: request.query.reviewState } : {}),
        ...(request.query.namespaceId ? { namespaceId: request.query.namespaceId } : {}),
        ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
        ...(request.query.limit ? { limit: request.query.limit } : {}),
      };
      return deps.memories.list(input);
    },
  );

  server.get<{ Params: MemoryParams; Querystring: MemoryDetailQuery }>(
    "/api/v2/memories/:id",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: { includeDeleted: { type: "boolean" } },
        },
      },
    },
    async (request, reply) => {
      const memory = deps.memories.get(request.params.id, { includeDeleted: request.query.includeDeleted === true });
      return memory ?? sendApiError(reply, 404, "not_found", "Memory not found");
    },
  );
  server.get<{ Params: MemoryParams }>("/api/v2/memories/:id/revisions", async (request, reply) => {
    if (!deps.memories.get(request.params.id, { includeDeleted: true }))
      return sendApiError(reply, 404, "not_found", "Memory not found");
    return { revisions: deps.memories.listRevisions(request.params.id) };
  });

  server.post<{ Body: CreateMemoryRecordInput }>(
    "/api/v2/memories",
    {
      schema: {
        body: {
          type: "object",
          required: ["workspaceId", "type", "statement", "confidence", "reviewState", "sourceIds"],
          additionalProperties: false,
          properties: {
            workspaceId: { type: "string", minLength: 1 },
            type: { type: "string", enum: memoryTypes },
            statement: { type: "string", minLength: 1 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reviewState: { type: "string", enum: reviewStates },
            sourceIds: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
          },
        },
      },
    },
    async (request, reply) => reply.code(201).send(deps.memoryService.create(request.body)),
  );

  server.patch<{ Params: MemoryParams; Body: MemoryMutationInput }>(
    "/api/v2/memories/:id",
    {
      schema: {
        body: {
          type: "object",
          required: ["expectedVersion", "reason"],
          additionalProperties: false,
          properties: {
            expectedVersion: { type: "integer", minimum: 1 },
            statement: { type: "string", minLength: 1 },
            reviewState: { type: "string", enum: reviewStates },
            pinned: { type: "boolean" },
            namespaceIds: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
            primaryNamespaceId: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
            reason: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return deps.memoryService.mutate(request.params.id, request.body);
      } catch (error) {
        return memoryError(reply, error);
      }
    },
  );

  server.delete<{ Params: MemoryParams; Body: DeleteBody }>(
    "/api/v2/memories/:id",
    {
      schema: {
        body: {
          type: "object",
          required: ["expectedVersion"],
          additionalProperties: false,
          properties: { expectedVersion: { type: "integer", minimum: 1 } },
        },
      },
    },
    async (request, reply) => {
      try {
        return deps.memoryService.delete(request.params.id, request.body.expectedVersion);
      } catch (error) {
        return memoryError(reply, error);
      }
    },
  );

  server.post(
    "/api/v2/memory-compactions",
    {
      schema: {
        body: {
          type: "object",
          required: ["workspaceId", "summary", "sources"],
          additionalProperties: false,
          properties: {
            workspaceId: { type: "string", minLength: 1 },
            summary: { type: "string", minLength: 1 },
            sources: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["kind", "id", "contentHash"],
                additionalProperties: false,
                properties: {
                  kind: { type: "string", enum: ["memory", "timeline_event"] },
                  id: { type: "string", minLength: 1 },
                  contentHash: { type: "string", minLength: 1 },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        return reply
          .code(201)
          .send(
            deps.memoryService.createCompaction(
              request.body as Parameters<typeof deps.memoryService.createCompaction>[0],
            ),
          );
      } catch {
        return sendApiError(reply, 409, "conflict", "Compaction sources are invalid");
      }
    },
  );
}

function memoryError(reply: FastifyReply, error: unknown) {
  if (error instanceof MemoryServiceError) {
    const status = error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : 400;
    return reply
      .code(status)
      .send(
        apiError(
          error.code === "invalid_state" ? "validation_error" : error.code,
          error.code === "conflict" ? "Memory changed" : error.message,
          reply.request.id,
          error.details,
        ),
      );
  }
  throw error;
}
