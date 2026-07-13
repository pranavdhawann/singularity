import { createEvent, createId, type PermissionCapability, type PermissionState } from "@future/core";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../server/dependencies";

const permissionCapabilities: PermissionCapability[] = [
  "read_files",
  "write_files",
  "run_commands",
  "browse_web",
  "call_apis",
  "write_memory",
  "use_external_models",
];

const permissionStates: PermissionState[] = [
  "deny",
  "ask_every_time",
  "allow_for_session",
  "allow_for_workspace",
  "always_allow",
];

interface PermissionQuery {
  workspaceId?: string;
}

interface PermissionRequestBody {
  workspaceId: string;
  capability: PermissionCapability;
  reason: string;
  dataAccess?: Record<string, unknown>;
}

interface PermissionDecisionBody {
  decision: "granted" | "denied";
  state?: PermissionState;
}

interface PermissionParams {
  id: string;
}

interface PermissionRuleRow {
  id: string;
  workspace_id: string | null;
  capability: PermissionCapability;
  state: PermissionState;
  scope_json: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PermissionRequestRow {
  id: string;
  workspace_id: string;
  capability: PermissionCapability;
  reason: string;
  data_access_json: string;
  decision: string | null;
  created_at: string;
  decided_at: string | null;
}

export async function registerPermissionRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  server.get<{ Querystring: PermissionQuery }>("/api/permissions", async (request) => {
    const ruleRows = deps.db
      .prepare<Record<string, string>, PermissionRuleRow>(
        `SELECT *
         FROM permission_rules
         ${request.query.workspaceId ? "WHERE workspace_id = @workspaceId" : ""}
         ORDER BY updated_at DESC`,
      )
      .all(request.query.workspaceId ? { workspaceId: request.query.workspaceId } : {});

    const requestRows = deps.db
      .prepare<Record<string, string>, PermissionRequestRow>(
        `SELECT *
         FROM permission_requests
         ${request.query.workspaceId ? "WHERE workspace_id = @workspaceId" : ""}
         ORDER BY created_at DESC`,
      )
      .all(request.query.workspaceId ? { workspaceId: request.query.workspaceId } : {});

    return {
      rules: ruleRows.map(rowToRule),
      requests: requestRows.map(rowToRequest),
    };
  });

  server.post<{ Body: PermissionRequestBody }>(
    "/api/permission-requests",
    {
      schema: {
        body: {
          type: "object",
          required: ["workspaceId", "capability", "reason"],
          additionalProperties: false,
          properties: {
            workspaceId: { type: "string", minLength: 1 },
            capability: { type: "string", enum: permissionCapabilities },
            reason: { type: "string", minLength: 1 },
            dataAccess: { type: "object", additionalProperties: true },
          },
        },
      },
    },
    async (request, reply) => {
      const now = new Date().toISOString();
      const permissionRequest = {
        id: createId("permreq"),
        workspaceId: request.body.workspaceId,
        capability: request.body.capability,
        reason: request.body.reason,
        dataAccessJson: JSON.stringify(request.body.dataAccess ?? {}),
        createdAt: now,
      };

      const insert = deps.db.transaction(() => {
        deps.db
          .prepare(
            `INSERT INTO permission_requests (
              id,
              workspace_id,
              capability,
              reason,
              data_access_json,
              decision,
              created_at,
              decided_at
            ) VALUES (
              @id,
              @workspaceId,
              @capability,
              @reason,
              @dataAccessJson,
              NULL,
              @createdAt,
              NULL
            )`,
          )
          .run(permissionRequest);

        deps.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: permissionRequest.workspaceId,
            type: "permission.requested",
            actor: "assistant",
            title: `Requested ${permissionRequest.capability}`,
            payload: { permissionRequestId: permissionRequest.id },
            privacy: { labels: ["local"] },
          }),
        );
      });

      insert();
      return reply.code(201).send({
        id: permissionRequest.id,
        workspaceId: permissionRequest.workspaceId,
        capability: permissionRequest.capability,
        reason: permissionRequest.reason,
        decision: null,
        createdAt: permissionRequest.createdAt,
      });
    },
  );

  server.post<{ Params: PermissionParams; Body: PermissionDecisionBody }>(
    "/api/permission-requests/:id/decide",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", minLength: 1 },
          },
        },
        body: {
          type: "object",
          required: ["decision"],
          additionalProperties: false,
          properties: {
            decision: { type: "string", enum: ["granted", "denied"] },
            state: { type: "string", enum: permissionStates },
          },
        },
      },
    },
    async (request, reply) => {
      const row = deps.db
        .prepare<{ id: string }, PermissionRequestRow>("SELECT * FROM permission_requests WHERE id = @id")
        .get({ id: request.params.id });

      if (!row) return reply.code(404).send({ error: "permission request not found" });

      const now = new Date().toISOString();
      const decide = deps.db.transaction(() => {
        deps.db
          .prepare(
            `UPDATE permission_requests
             SET decision = @decision,
                 decided_at = @decidedAt
             WHERE id = @id`,
          )
          .run({ id: row.id, decision: request.body.decision, decidedAt: now });

        if (request.body.decision === "granted") {
          deps.db
            .prepare(
              `INSERT INTO permission_rules (
                id,
                workspace_id,
                capability,
                state,
                scope_json,
                expires_at,
                created_at,
                updated_at
              ) VALUES (
                @id,
                @workspaceId,
                @capability,
                @state,
                @scopeJson,
                NULL,
                @createdAt,
                @updatedAt
              )`,
            )
            .run({
              id: createId("permrule"),
              workspaceId: row.workspace_id,
              capability: row.capability,
              state: request.body.state ?? "allow_for_workspace",
              scopeJson: JSON.stringify({ workspaceId: row.workspace_id }),
              createdAt: now,
              updatedAt: now,
            });
        }

        deps.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: row.workspace_id,
            type: request.body.decision === "granted" ? "permission.granted" : "permission.denied",
            actor: "user",
            title: `${request.body.decision} ${row.capability}`,
            payload: { permissionRequestId: row.id },
            privacy: { labels: ["local"] },
          }),
        );
      });

      decide();
      return {
        id: row.id,
        decision: request.body.decision,
        decidedAt: now,
      };
    },
  );
}

function rowToRule(row: PermissionRuleRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    capability: row.capability,
    state: row.state,
    scope: JSON.parse(row.scope_json) as Record<string, unknown>,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRequest(row: PermissionRequestRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    capability: row.capability,
    reason: row.reason,
    dataAccess: JSON.parse(row.data_access_json) as Record<string, unknown>,
    decision: row.decision,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };
}
