import {
  EventRepository,
  ModelProfileRepository,
  ProviderRepository,
  openDatabase
} from "@future/db";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { registerCommandRoutes } from "../routes/commands";
import { registerContextPackRoutes } from "../routes/context-packs";
import { registerHealthRoutes } from "../routes/health";
import { registerImportRoutes } from "../routes/imports";
import { registerMemoryRoutes } from "../routes/memories";
import { registerPermissionRoutes } from "../routes/permissions";
import { registerProviderRoutes } from "../routes/providers";
import { registerTimelineRoutes } from "../routes/timeline";
import { registerWorkspaceRoutes } from "../routes/workspaces";
import { ProviderService } from "../services/provider-service";
import type { ApiDependencies } from "./dependencies";
import { registerApiErrorHandler } from "./api-errors";
import { registerLocalSession } from "./local-session";

export interface CreateServerOptions {
  databasePath: string;
  sessionToken?: string;
  allowedOrigins?: readonly string[];
}

export async function createServer(options: CreateServerOptions): Promise<FastifyInstance> {
  const db = openDatabase({ path: options.databasePath });
  const providers = new ProviderRepository(db);
  const modelProfiles = new ModelProfileRepository(db);
  const deps: ApiDependencies = {
    db,
    events: new EventRepository(db),
    providers,
    modelProfiles,
    providerService: new ProviderService(providers, modelProfiles)
  };
  const server = Fastify({ logger: false });
  registerApiErrorHandler(server);
  await registerLocalSession(
    server,
    options.sessionToken ?? randomUUID(),
    options.allowedOrigins ?? ["http://127.0.0.1:4173"]
  );

  server.addHook("onClose", async () => {
    if (db.open) {
      db.close();
    }
  });

  await registerHealthRoutes(server);
  await registerWorkspaceRoutes(server, deps);
  await registerImportRoutes(server, deps);
  await registerMemoryRoutes(server, deps);
  await registerProviderRoutes(server, deps);
  await registerPermissionRoutes(server, deps);
  await registerContextPackRoutes(server, deps);
  await registerCommandRoutes(server, deps);
  await registerTimelineRoutes(server, deps);

  return server;
}
