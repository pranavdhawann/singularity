import type { SecretStore } from "@future/core";
import type {
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
  SqliteDatabase,
} from "@future/db";
import type { RedactionEngine } from "@future/permissions";
import type { AssistantService } from "../services/assistant-service";
import type { ContextService } from "../services/context-service";
import type { MemoryService } from "../services/memory-service";
import type { ImportService } from "../services/import-service";
import type { ProviderService } from "../services/provider-service";
import type { ProviderConnectionService } from "../services/provider-connection-service";
import type { PromptPreviewService } from "../services/prompt-preview-service";
import type { TurnCancellationRegistry } from "../services/turn-cancellation";

export interface ApiDependencies {
  db: SqliteDatabase;
  turns: AssistantTurnRepository;
  contextPacks: ContextPackRepository;
  events: EventRepository;
  importJobs: ImportJobRepository;
  memories: MemoryRepository;
  namespaces: NamespaceRepository;
  compactions: CompactionRepository;
  embeddings: EmbeddingRepository;
  providers: ProviderRepository;
  promptPreviews: PromptPreviewRepository;
  modelProfiles: ModelProfileRepository;
  secrets: SecretStore;
  redaction: RedactionEngine;
  getSettings: (workspaceId: string) => { redactLocalToo: boolean; autoCapture: boolean };
  providerService: ProviderService;
  providerConnectionService: ProviderConnectionService;
  promptPreviewService: PromptPreviewService;
  contextService: ContextService;
  memoryService: MemoryService;
  importService: ImportService;
  assistantService: AssistantService;
  cancellations: TurnCancellationRegistry;
}
