import Database from "better-sqlite3";
import { schemaStatements } from "./schema";

export type SqliteDatabase = InstanceType<typeof Database>;

export interface OpenDatabaseOptions {
  readonly path: string;
}

export function openDatabase(options: OpenDatabaseOptions): SqliteDatabase {
  const db = new Database(options.path);
  db.pragma("foreign_keys = ON");
  initializeSchema(db);
  return db;
}

export function initializeSchema(db: SqliteDatabase): void {
  const createSchema = db.transaction(() => {
    for (const statement of schemaStatements) {
      db.exec(statement);
    }
  });

  createSchema();
}
