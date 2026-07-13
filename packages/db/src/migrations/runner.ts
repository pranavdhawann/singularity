import type { SqliteDatabase } from "../connection";
import { initialMigration } from "./0001-initial";
import { continuousAssistantMigration } from "./0002-continuous-assistant";
import { memoryHybridRetrievalMigration } from "./0003-memory-hybrid-retrieval";
import { importsExternalModelsMigration } from "./0004-imports-external-models";
import type { Migration, MigrationRecord } from "./types";

export const migrations: readonly Migration[] = [
  initialMigration,
  continuousAssistantMigration,
  memoryHybridRetrievalMigration,
  importsExternalModelsMigration,
];

export function validateMigrationOrder(candidateMigrations: readonly Migration[] = migrations): void {
  for (let index = 1; index < candidateMigrations.length; index += 1) {
    const previous = candidateMigrations[index - 1];
    const current = candidateMigrations[index];
    if (previous && current && current.id <= previous.id) {
      throw new Error(`Migration IDs must be strictly increasing: ${current.id} follows ${previous.id}`);
    }
  }
}

export function runMigrations(db: SqliteDatabase): MigrationRecord[] {
  validateMigrationOrder();
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const apply = db.transaction(() => {
    for (const migration of migrations) {
      const applied = db.prepare("SELECT checksum FROM schema_migrations WHERE id = ?").get(migration.id) as
        { checksum: string } | undefined;

      if (applied && applied.checksum !== migration.checksum) {
        throw new Error(`Migration checksum mismatch: ${migration.id}`);
      }

      if (applied) {
        continue;
      }

      migration.up(db);
      db.prepare("INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (?, ?, ?)").run(
        migration.id,
        migration.checksum,
        new Date().toISOString(),
      );
    }
  });

  apply();

  return db
    .prepare(
      `SELECT
        id,
        checksum,
        applied_at AS appliedAt
       FROM schema_migrations
       ORDER BY id`,
    )
    .all() as MigrationRecord[];
}
