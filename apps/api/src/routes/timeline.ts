import type { FastifyInstance } from "fastify";
import type { EventListOptions } from "@future/db";
import type { ApiDependencies } from "../server/dependencies";

interface TimelineQuery {
  workspaceId?: string;
  type?: string;
  limit?: string;
}

export async function registerTimelineRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  server.get<{ Querystring: TimelineQuery }>(
    "/api/timeline",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            workspaceId: { type: "string" },
            type: { type: "string" },
            limit: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const parsedLimit = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;
      const options: EventListOptions = {
        ...(request.query.workspaceId ? { workspaceId: request.query.workspaceId } : {}),
        ...(request.query.type ? { type: request.query.type } : {}),
        ...(typeof parsedLimit === "number" && Number.isFinite(parsedLimit) ? { limit: parsedLimit } : {}),
      };
      const events = deps.events.list(options);

      return { events };
    },
  );
}
