import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../../server/dependencies";
import { sendApiError } from "../../server/api-errors";

interface ContextPackParams { id: string }

export async function registerV2ContextPackRoutes(
  server: FastifyInstance,
  deps: ApiDependencies
): Promise<void> {
  server.get<{ Params: ContextPackParams }>(
    "/api/v2/context-packs/:id",
    async (request, reply) => {
      const pack = deps.contextPacks.get(request.params.id);
      if (!pack) return sendApiError(reply, 404, "not_found", "Context pack not found");
      const turn = deps.turns.get(pack.turnId);
      if (!turn || turn.workspaceId !== pack.workspaceId) {
        return sendApiError(reply, 404, "not_found", "Context pack not found");
      }
      return pack;
    }
  );
}
