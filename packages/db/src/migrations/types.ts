import type { SqliteDatabase } from "../connection";

export interface Migration {
  id: string;
  checksum: string;
  up(db: SqliteDatabase): void;
}

export interface MigrationRecord {
  id: string;
  checksum: string;
  appliedAt: string;
}
