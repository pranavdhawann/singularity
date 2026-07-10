import { createEvent, createId, type CreateWorkspaceInput, type WorkspaceDto } from "@future/core";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../../server/dependencies";

interface WorkspaceRow {
  id: string;
  name: string;
  kind: string;
  root_path: string | null;
  privacy_mode: "standard" | "local_only";
  created_at: string;
  updated_at: string;
}

export async function registerV2WorkspaceRoutes(
  server: FastifyInstance,
  deps: ApiDependencies
): Promise<void> {
  server.get("/api/v2/workspaces", async () => {
    const rows = deps.db
      .prepare<[], WorkspaceRow>(
        `SELECT id, name, kind, root_path, privacy_mode, created_at, updated_at
         FROM workspaces
         WHERE archived_at IS NULL
         ORDER BY created_at DESC`
      )
      .all();
    return { workspaces: rows.map(rowToWorkspace) };
  });

  server.post<{ Body: CreateWorkspaceInput }>(
    "/api/v2/workspaces",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "privacyMode"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1 },
            kind: { type: "string", minLength: 1 },
            privacyMode: { type: "string", enum: ["standard", "local_only"] },
            rootPath: { type: "string", minLength: 1 }
          }
        }
      }
    },
    async (request, reply) => {
      const workspace = deps.db.transaction((input: CreateWorkspaceInput) => {
        const now = new Date().toISOString();
        const row: WorkspaceRow = {
          id: createId("w"),
          name: input.name,
          kind: input.kind ?? "project",
          root_path: input.rootPath ?? null,
          privacy_mode: input.privacyMode,
          created_at: now,
          updated_at: now
        };

        deps.db
          .prepare(
            `INSERT INTO workspaces (
              id, name, kind, root_path, privacy_mode, created_at, updated_at
            ) VALUES (
              @id, @name, @kind, @root_path, @privacy_mode, @created_at, @updated_at
            )`
          )
          .run(row);

        deps.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: row.id,
            type: "workspace.created",
            actor: "user",
            title: `Created ${row.name}`,
            payload: {
              name: row.name,
              kind: row.kind,
              rootPath: row.root_path,
              privacyMode: row.privacy_mode
            },
            privacy: { labels: ["local"] }
          })
        );

        return rowToWorkspace(row);
      })(request.body);

      return reply.code(201).send(workspace);
    }
  );
}

function rowToWorkspace(row: WorkspaceRow): WorkspaceDto {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    ...(row.root_path ? { rootPath: row.root_path } : {}),
    privacyMode: row.privacy_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
