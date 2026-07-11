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
  NamespaceRepository,
  SqliteDatabase
} from "@future/db";
import type { AssistantService } from "../services/assistant-service";
import type { ContextService } from "../services/context-service";
import type { MemoryService } from "../services/memory-service";
import type { ImportService } from "../services/import-service";
import type { ProviderService } from "../services/provider-service";
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
  modelProfiles: ModelProfileRepository;
  providerService: ProviderService;
  contextService: ContextService;
  memoryService: MemoryService;
  importService: ImportService;
  assistantService: AssistantService;
  cancellations: TurnCancellationRegistry;
}
