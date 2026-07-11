import {
  AssistantTurnRepository,
  CompactionRepository,
  ContextPackRepository,
  EventRepository,
  ImportJobRepository,
  EmbeddingRepository,
  MemoryRepository,
  ModelProfileRepository,
  ProviderRepository,
  PromptPreviewRepository,
  NamespaceRepository,
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
import { registerV2HealthRoutes } from "../routes/v2/health";
import { registerV2ImportRoutes } from "../routes/v2/imports";
import { registerV2AssistantTurnRoutes } from "../routes/v2/assistant-turns";
import { registerV2ContextPackRoutes } from "../routes/v2/context-packs";
import { registerV2MemoryRoutes } from "../routes/v2/memories";
import { registerV2NamespaceRoutes } from "../routes/v2/namespaces";
import { registerV2ProviderRoutes } from "../routes/v2/providers";
import { registerV2PromptPreviewRoutes } from "../routes/v2/prompt-previews";
import { registerV2SearchRoutes } from "../routes/v2/search";
import { registerV2TimelineRoutes } from "../routes/v2/timeline";
import { registerV2WorkspaceRoutes } from "../routes/v2/workspaces";
import { AssistantService } from "../services/assistant-service";
import { ContextService } from "../services/context-service";
import { MemoryService } from "../services/memory-service";
import { ImportService } from "../services/import-service";
import { ProviderService } from "../services/provider-service";
import { PromptPreviewService } from "../services/prompt-preview-service";
import { TurnCancellationRegistry } from "../services/turn-cancellation";
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
  const promptPreviews = new PromptPreviewRepository(db);
  const modelProfiles = new ModelProfileRepository(db);
  const events = new EventRepository(db);
  const importJobs = new ImportJobRepository(db);
  const turns = new AssistantTurnRepository(db);
  const contextPacks = new ContextPackRepository(db);
  const memories = new MemoryRepository(db);
  const namespaces = new NamespaceRepository(db);
  const compactions = new CompactionRepository(db);
  const embeddings = new EmbeddingRepository(db);
  const providerService = new ProviderService(providers, modelProfiles);
  const contextService = new ContextService({ db, events, contextPacks, embeddings, compactions,
    embeddingResolver: providerService });
  const cancellations = new TurnCancellationRegistry();
  const deps: ApiDependencies = {
    db,
    turns,
    contextPacks,
    events,
    importJobs,
    memories,
    namespaces,
    compactions,
    embeddings,
    providers,
    promptPreviews,
    modelProfiles,
    providerService,
    promptPreviewService: new PromptPreviewService({ previews: promptPreviews }),
    contextService,
    memoryService: new MemoryService({ db, memories, namespaces, compactions, embeddings, events }),
    importService: new ImportService({ db, jobs: importJobs, events }),
    cancellations,
    assistantService: new AssistantService({
      db,
      turns,
      events,
      contextService,
      providerService,
      cancellations
    })
  };
  const server = Fastify({
    logger: false,
    ajv: {
      customOptions: {
        removeAdditional: false
      }
    }
  });
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

  await registerV2HealthRoutes(server, deps);
  await registerV2ImportRoutes(server, deps);
  await registerV2WorkspaceRoutes(server, deps);
  await registerV2ProviderRoutes(server, deps);
  await registerV2PromptPreviewRoutes(server, deps);
  await registerV2AssistantTurnRoutes(server, deps);
  await registerV2TimelineRoutes(server, deps);
  await registerV2ContextPackRoutes(server, deps);
  await registerV2MemoryRoutes(server, deps);
  await registerV2NamespaceRoutes(server, deps);
  await registerV2SearchRoutes(server, deps);

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
