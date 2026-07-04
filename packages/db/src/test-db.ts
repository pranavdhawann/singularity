import { openDatabase, type SqliteDatabase } from "./connection";

export interface TestDb {
  client: SqliteDatabase;
  close(): void;
}

export function createTestDb(): TestDb {
  const client = openDatabase({ path: ":memory:" });

  return {
    client,
    close() {
      client.close();
    }
  };
}
