import { SearchRepository } from "@future/db";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../../server/dependencies";

export async function registerV2SearchRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  const search = new SearchRepository(deps.db);
  server.get<{ Querystring: { workspaceId: string; query: string; limit?: number } }>(
    "/api/v2/search",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["workspaceId", "query"],
          additionalProperties: false,
          properties: {
            workspaceId: { type: "string", minLength: 1 },
            query: { type: "string", minLength: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (request) => ({
      results: search.search({
        workspaceId: request.query.workspaceId,
        query: request.query.query,
        ...(request.query.limit ? { limit: request.query.limit } : {}),
      }),
      retrieval: { mode: "lexical", fallbackReason: "inspection_only" },
    }),
  );
}
