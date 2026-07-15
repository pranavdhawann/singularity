import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../../server/dependencies";

interface SecretPostBody {
  name: string;
  value: string;
}

export async function registerV2SecretRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  server.post<{ Body: SecretPostBody }>(
    "/api/v2/secrets",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "value"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1 },
            value: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      deps.secrets.set(request.body.name, request.body.value);
      return reply.code(201).send({ names: deps.secrets.list() });
    },
  );
}
