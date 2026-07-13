import type { CreateModelProfileInput, CreateProviderInput, TestProviderConnectionInput } from "@future/core";
import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../server/api-errors";
import type { ApiDependencies } from "../../server/dependencies";

interface ModelProfileQuery {
  providerId?: string;
}

export async function registerV2ProviderRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  server.get("/api/v2/providers", async () => ({ providers: deps.providers.list() }));

  server.post<{ Body: TestProviderConnectionInput }>(
    "/api/v2/providers/connection-test",
    {
      schema: {
        body: {
          type: "object",
          required: ["kind", "baseUrl", "secretEnvironmentVariable"],
          additionalProperties: false,
          properties: {
            kind: { type: "string", enum: ["openai-compatible"] },
            baseUrl: { type: "string", minLength: 1 },
            secretEnvironmentVariable: {
              type: "string",
              pattern: "^[A-Z][A-Z0-9_]*$",
            },
          },
        },
      },
    },
    async (request) => deps.providerConnectionService.test(request.body),
  );

  server.post<{ Body: CreateProviderInput }>(
    "/api/v2/providers",
    {
      schema: {
        body: {
          type: "object",
          required: ["kind", "displayName", "isLocal"],
          additionalProperties: false,
          properties: {
            kind: { type: "string", enum: ["mock", "ollama", "openai-compatible"] },
            displayName: { type: "string", minLength: 1 },
            baseUrl: { type: "string", minLength: 1 },
            secretEnvironmentVariable: {
              type: "string",
              pattern: "^[A-Z][A-Z0-9_]*$",
            },
            isLocal: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => reply.code(201).send(deps.providers.create(request.body)),
  );

  server.get<{ Querystring: ModelProfileQuery }>(
    "/api/v2/model-profiles",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: { providerId: { type: "string", minLength: 1 } },
        },
      },
    },
    async (request) => ({
      modelProfiles: deps.modelProfiles.list(request.query.providerId),
    }),
  );

  server.post<{ Body: CreateModelProfileInput }>(
    "/api/v2/model-profiles",
    {
      schema: {
        body: {
          type: "object",
          required: ["providerId", "name", "model", "contextWindow", "purpose", "privacyPolicy"],
          additionalProperties: false,
          properties: {
            providerId: { type: "string", minLength: 1 },
            name: { type: "string", minLength: 1 },
            model: { type: "string", minLength: 1 },
            embeddingModel: { type: "string", minLength: 1 },
            contextWindow: { type: "integer", minimum: 1 },
            purpose: { type: "string", minLength: 1 },
            temperature: { type: "number", minimum: 0, maximum: 2 },
            privacyPolicy: {
              type: "string",
              enum: ["local_only", "prompt_preview"],
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!deps.providers.get(request.body.providerId)) {
        return sendApiError(reply, 404, "not_found", "Provider not found");
      }
      return reply.code(201).send(deps.modelProfiles.create(request.body));
    },
  );
}
