import Database from "better-sqlite3";
import { runMigrations } from "./migrations/runner";

export type SqliteDatabase = InstanceType<typeof Database>;

export interface OpenDatabaseOptions {
  readonly path: string;
}

export function openDatabase(options: OpenDatabaseOptions): SqliteDatabase {
  const db = new Database(options.path);
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function initializeSchema(db: SqliteDatabase): void {
  runMigrations(db);
}
