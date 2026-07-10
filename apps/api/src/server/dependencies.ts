import type {
  AssistantTurnRepository,
  ContextPackRepository,
  EventRepository,
  ModelProfileRepository,
  ProviderRepository,
  SqliteDatabase
} from "@future/db";
import type { AssistantService } from "../services/assistant-service";
import type { ContextService } from "../services/context-service";
import type { ProviderService } from "../services/provider-service";
import type { TurnCancellationRegistry } from "../services/turn-cancellation";

export interface ApiDependencies {
  db: SqliteDatabase;
  turns: AssistantTurnRepository;
  contextPacks: ContextPackRepository;
  events: EventRepository;
  providers: ProviderRepository;
  modelProfiles: ModelProfileRepository;
  providerService: ProviderService;
  contextService: ContextService;
  assistantService: AssistantService;
  cancellations: TurnCancellationRegistry;
}
