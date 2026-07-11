import { NamespaceConflictError } from "@future/db";
import type { CreateNamespaceInput } from "@future/core";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../../server/dependencies";
import { sendApiError } from "../../server/api-errors";

export async function registerV2NamespaceRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  server.get<{ Querystring: { workspaceId: string } }>("/api/v2/namespaces", {
    schema: { querystring: { type: "object", required: ["workspaceId"], additionalProperties: false,
      properties: { workspaceId: { type: "string", minLength: 1 } } } }
  }, async (request) => ({ namespaces: deps.namespaces.list(request.query.workspaceId) }));
  server.post<{ Body: CreateNamespaceInput }>("/api/v2/namespaces", {
    schema: { body: { type: "object", required: ["workspaceId", "name"], additionalProperties: false,
      properties: { workspaceId: { type: "string", minLength: 1 }, name: { type: "string", minLength: 1 },
        parentId: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] } } } }
  }, async (request, reply) => {
    try { return reply.code(201).send(deps.memoryService.createNamespace(request.body)); }
    catch (error) {
      if (error instanceof NamespaceConflictError) return sendApiError(reply, 409, "conflict", error.message);
      throw error;
    }
  });
}
