import type { EventRepository, SqliteDatabase } from "@future/db";

export interface ApiDependencies {
  db: SqliteDatabase;
  events: EventRepository;
}
