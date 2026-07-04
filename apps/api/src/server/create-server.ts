import { EventRepository, openDatabase } from "@future/db";
import Fastify, { type FastifyInstance } from "fastify";
import { registerHealthRoutes } from "../routes/health";
import { registerImportRoutes } from "../routes/imports";
import { registerTimelineRoutes } from "../routes/timeline";
import { registerWorkspaceRoutes } from "../routes/workspaces";
import type { ApiDependencies } from "./dependencies";

export interface CreateServerOptions {
  databasePath: string;
}

export async function createServer(options: CreateServerOptions): Promise<FastifyInstance> {
  const db = openDatabase({ path: options.databasePath });
  const deps: ApiDependencies = {
    db,
    events: new EventRepository(db)
  };
  const server = Fastify({ logger: false });

  server.addHook("onClose", async () => {
    if (db.open) {
      db.close();
    }
  });

  await registerHealthRoutes(server);
  await registerWorkspaceRoutes(server, deps);
  await registerImportRoutes(server, deps);
  await registerTimelineRoutes(server, deps);

  return server;
}
