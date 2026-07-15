import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../../server/dependencies";

interface SettingsQuery {
  workspaceId: string;
}

interface SettingsPatchBody {
  workspaceId: string;
  redactLocalToo?: boolean;
  autoCapture?: boolean;
}

export async function registerV2SettingsRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  server.get<{ Querystring: SettingsQuery }>(
    "/api/v2/settings",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["workspaceId"],
          additionalProperties: false,
          properties: { workspaceId: { type: "string", minLength: 1 } },
        },
      },
    },
    async (request) => deps.workspaceSettings.get(request.query.workspaceId),
  );

  server.patch<{ Body: SettingsPatchBody }>(
    "/api/v2/settings",
    {
      schema: {
        body: {
          type: "object",
          required: ["workspaceId"],
          additionalProperties: false,
          properties: {
            workspaceId: { type: "string", minLength: 1 },
            redactLocalToo: { type: "boolean" },
            autoCapture: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const { workspaceId, ...update } = request.body;
      return deps.workspaceSettings.update(workspaceId, update);
    },
  );
}
