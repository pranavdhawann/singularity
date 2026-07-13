import Database from "better-sqlite3";
import { mkdtemp, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./runner";

export interface MigrationSmokeResult {
  readonly ids: string[];
  readonly databasePath: string;
}

export async function runMigrationSmoke({
  log = console.log,
}: {
  readonly log?: (line: string) => void;
} = {}): Promise<MigrationSmokeResult> {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "singularity-migration-smoke-"));
  const databasePath = path.join(temporaryDirectory, "smoke.sqlite");
  let db: Database.Database | undefined;

  try {
    db = new Database(databasePath);
    const ids = runMigrations(db).map((migration) => migration.id);
    for (const id of ids) log(id);
    return { ids, databasePath };
  } finally {
    db?.close();
    await rm(databasePath, { force: true });
    await rmdir(temporaryDirectory);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await runMigrationSmoke();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
