import { serializeTimelineEvent } from "@future/core";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../../server/dependencies";

interface TimelineQuery {
  workspaceId: string;
  after?: string;
  limit?: number;
}

export async function registerV2TimelineRoutes(
  server: FastifyInstance,
  deps: ApiDependencies
): Promise<void> {
  server.get<{ Querystring: TimelineQuery }>(
    "/api/v2/timeline",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["workspaceId"],
          additionalProperties: false,
          properties: {
            workspaceId: { type: "string", minLength: 1 },
            after: { type: "string", minLength: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 }
          }
        }
      }
    },
    async (request) => {
      const events = deps.events.list({
        workspaceId: request.query.workspaceId,
        order: "asc",
        limit: request.query.limit ?? 100,
        ...(request.query.after ? { after: request.query.after } : {})
      });
      const serialized = events.map((event) => ({
        ...serializeTimelineEvent(event),
        citations: deps.events.listSources(event.id)
      }));
      return {
        events: serialized,
        ...(serialized.length ? { nextCursor: serialized.at(-1)?.id } : {})
      };
    }
  );
}
