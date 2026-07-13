import { createEvent, createId } from "@future/core";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../server/dependencies";

interface CreateWorkspaceBody {
  name: string;
  kind?: string;
  rootPath?: string;
  privacyMode?: string;
}

interface WorkspaceResponse {
  id: string;
  name: string;
  kind: string;
  privacyMode: string;
  createdAt: string;
  updatedAt: string;
  rootPath?: string;
}

interface WorkspaceRow {
  id: string;
  name: string;
  kind: string;
  root_path: string | null;
  privacy_mode: string;
  created_at: string;
  updated_at: string;
}

function rowToWorkspace(row: WorkspaceRow): WorkspaceResponse {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    ...(row.root_path ? { rootPath: row.root_path } : {}),
    privacyMode: row.privacy_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function registerWorkspaceRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  server.get("/api/workspaces", async () => {
    const rows = deps.db
      .prepare<[], WorkspaceRow>(
        `SELECT id, name, kind, root_path, privacy_mode, created_at, updated_at
         FROM workspaces
         WHERE archived_at IS NULL
         ORDER BY created_at DESC`,
      )
      .all();

    return { workspaces: rows.map(rowToWorkspace) };
  });

  server.post<{ Body: CreateWorkspaceBody }>(
    "/api/workspaces",
    {
      schema: {
        body: {
          type: "object",
          required: ["name"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1 },
            kind: { type: "string" },
            rootPath: { type: "string" },
            privacyMode: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const createWorkspace = deps.db.transaction((body: CreateWorkspaceBody) => {
        const now = new Date();
        const workspace = {
          id: createId("w"),
          name: body.name,
          kind: body.kind ?? "project",
          rootPath: body.rootPath ?? null,
          privacyMode: body.privacyMode ?? "standard",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        deps.db
          .prepare(
            `INSERT INTO workspaces (
              id,
              name,
              kind,
              root_path,
              privacy_mode,
              created_at,
              updated_at
            ) VALUES (
              @id,
              @name,
              @kind,
              @rootPath,
              @privacyMode,
              @createdAt,
              @updatedAt
            )`,
          )
          .run(workspace);

        deps.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: workspace.id,
            type: "workspace.created",
            actor: "user",
            title: `Created ${workspace.name}`,
            payload: {
              name: workspace.name,
              kind: workspace.kind,
              rootPath: workspace.rootPath,
              privacyMode: workspace.privacyMode,
            },
            privacy: { labels: ["local"] },
          }),
        );

        return workspace;
      });

      const workspace = createWorkspace(request.body);
      return reply.code(201).send({
        id: workspace.id,
        name: workspace.name,
        kind: workspace.kind,
        ...(workspace.rootPath ? { rootPath: workspace.rootPath } : {}),
        privacyMode: workspace.privacyMode,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      });
    },
  );
}
