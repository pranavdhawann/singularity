import { PromptPreviewRepository, createTestDb } from "@future/db";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerLocalSession } from "../../server/local-session";
import type { ApiDependencies } from "../../server/dependencies";
import { PromptPreviewService } from "../../services/prompt-preview-service";
import { registerV2PromptPreviewRoutes } from "./prompt-previews";

describe("V2 prompt preview routes", () => {
  it("returns a workspace-scoped preview and records one protected decision", async () => {
    const db = createTestDb();
    const previews = new PromptPreviewRepository(db.client);
    const service = new PromptPreviewService({
      previews,
      now: () => new Date("2026-07-11T00:00:00.000Z")
    });
    const preview = service.createForTurn({
      workspaceId: "w_1", turnId: "turn_1", providerId: "provider_1",
      modelProfileId: "profile_1", model: "model-1", contextPackId: "pack_1",
      contextPackHash: "pack-hash", instructions: "Be useful", userText: "hello", segments: []
    });
    const server = Fastify({ logger: false });
    await registerLocalSession(server, "test-token", ["http://127.0.0.1:4173"]);
    await registerV2PromptPreviewRoutes(server, {
      promptPreviews: previews,
      promptPreviewService: service
    } as ApiDependencies);

    const get = await server.inject({
      method: "GET", url: `/api/v2/prompt-previews/${preview.id}?workspaceId=w_1`
    });
    const unauthorized = await server.inject({
      method: "POST", url: `/api/v2/prompt-previews/${preview.id}/decision`,
      payload: { workspaceId: "w_1", decision: "approved", bindingHash: preview.bindingHash }
    });
    const approve = await server.inject({
      method: "POST", url: `/api/v2/prompt-previews/${preview.id}/decision`,
      headers: { "x-future-session": "test-token" },
      payload: { workspaceId: "w_1", decision: "approved", bindingHash: preview.bindingHash }
    });
    const duplicate = await server.inject({
      method: "POST", url: `/api/v2/prompt-previews/${preview.id}/decision`,
      headers: { "x-future-session": "test-token" },
      payload: { workspaceId: "w_1", decision: "denied", bindingHash: preview.bindingHash }
    });

    expect(get.statusCode).toBe(200);
    expect(get.json()).toEqual(preview);
    expect(unauthorized.statusCode).toBe(401);
    expect(approve.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(409);
    await server.close();
    db.close();
  });
});
