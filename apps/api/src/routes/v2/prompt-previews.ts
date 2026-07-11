import { apiError } from "@future/core";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../../server/dependencies";
import { PromptPreviewServiceError } from "../../services/prompt-preview-service";

interface PreviewParams { id: string }
interface PreviewQuery { workspaceId?: string }
interface DecisionBody {
  workspaceId: string;
  decision: "approved" | "denied";
  bindingHash: string;
}

export async function registerV2PromptPreviewRoutes(
  server: FastifyInstance,
  deps: ApiDependencies
): Promise<void> {
  server.get<{ Params: PreviewParams; Querystring: PreviewQuery }>(
    "/api/v2/prompt-previews/:id",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.code(400).send(apiError("validation_error", "workspaceId is required", request.id));
      }
      const preview = deps.promptPreviewService.get(request.params.id, request.query.workspaceId);
      return preview ?? reply.code(404).send(apiError("not_found", "Prompt preview not found", request.id));
    }
  );

  server.post<{ Params: PreviewParams; Body: DecisionBody }>(
    "/api/v2/prompt-previews/:id/decision",
    {
      schema: {
        body: {
          type: "object",
          required: ["workspaceId", "decision", "bindingHash"],
          additionalProperties: false,
          properties: {
            workspaceId: { type: "string" },
            decision: { type: "string", enum: ["approved", "denied"] },
            bindingHash: { type: "string" }
          }
        }
      }
    },
    async (request, reply) => {
      const preview = deps.promptPreviewService.get(request.params.id, request.body.workspaceId);
      if (!preview) {
        return reply.code(404).send(apiError("not_found", "Prompt preview not found", request.id));
      }
      try {
        const decision = deps.promptPreviewService.decide(
          preview.id,
          request.body.decision,
          request.body.bindingHash
        );
        return reply.code(201).send(decision);
      } catch (error) {
        if (error instanceof PromptPreviewServiceError) {
          const status = error.code === "preview_expired" ? 410 : 409;
          return reply.code(status).send(apiError(
            error.code === "preview_expired" ? "conflict" : "conflict",
            error.code === "preview_expired" ? "Prompt preview expired" : "Prompt preview conflict",
            request.id
          ));
        }
        throw error;
      }
    }
  );
}
