import { createId } from "@future/core";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../server/dependencies";

const providerKinds = ["openai-compatible", "ollama", "mock"] as const;

interface ProviderBody {
  kind: "openai-compatible" | "ollama" | "mock";
  displayName: string;
  baseUrl?: string;
  apiKeyRef?: string;
  isLocal?: boolean;
}

interface ProviderRow {
  id: string;
  kind: string;
  display_name: string;
  base_url: string | null;
  api_key_ref: string | null;
  is_local: 0 | 1;
  capabilities_json: string;
}

export async function registerProviderRoutes(
  server: FastifyInstance,
  deps: ApiDependencies
): Promise<void> {
  server.get("/api/providers", async () => {
    const rows = deps.db.prepare<[], ProviderRow>("SELECT * FROM providers ORDER BY display_name").all();
    return {
      providers: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        displayName: row.display_name,
        baseUrl: row.base_url,
        apiKeyRef: row.api_key_ref,
        isLocal: row.is_local === 1,
        capabilities: JSON.parse(row.capabilities_json) as Record<string, unknown>
      }))
    };
  });

  server.post<{ Body: ProviderBody }>(
    "/api/providers",
    {
      schema: {
        body: {
          type: "object",
          required: ["kind", "displayName"],
          additionalProperties: false,
          properties: {
            kind: { type: "string", enum: providerKinds },
            displayName: { type: "string", minLength: 1 },
            baseUrl: { type: "string" },
            apiKeyRef: { type: "string" },
            isLocal: { type: "boolean" }
          }
        }
      }
    },
    async (request, reply) => {
      const now = new Date().toISOString();
      const provider = {
        id: createId("prov"),
        kind: request.body.kind,
        displayName: request.body.displayName,
        baseUrl: request.body.baseUrl ?? null,
        apiKeyRef: request.body.apiKeyRef ?? null,
        isLocal: request.body.isLocal ?? request.body.kind !== "openai-compatible",
        capabilitiesJson: JSON.stringify({ streaming: true, text: true }),
        createdAt: now,
        updatedAt: now
      };

      deps.db
        .prepare(
          `INSERT INTO providers (
          id,
          kind,
          display_name,
          base_url,
          api_key_ref,
          is_local,
          capabilities_json,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @kind,
          @displayName,
          @baseUrl,
          @apiKeyRef,
          @isLocal,
          @capabilitiesJson,
          @createdAt,
          @updatedAt
        )`
        )
        .run({ ...provider, isLocal: provider.isLocal ? 1 : 0 });

      return reply.code(201).send({
        id: provider.id,
        kind: provider.kind,
        displayName: provider.displayName,
        baseUrl: provider.baseUrl,
        apiKeyRef: provider.apiKeyRef,
        isLocal: provider.isLocal,
        capabilities: JSON.parse(provider.capabilitiesJson) as Record<string, unknown>
      });
    }
  );
}
