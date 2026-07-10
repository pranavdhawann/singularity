import type {
  EventRepository,
  ModelProfileRepository,
  ProviderRepository,
  SqliteDatabase
} from "@future/db";
import type { ProviderService } from "../services/provider-service";

export interface ApiDependencies {
  db: SqliteDatabase;
  events: EventRepository;
  providers: ProviderRepository;
  modelProfiles: ModelProfileRepository;
  providerService: ProviderService;
}
