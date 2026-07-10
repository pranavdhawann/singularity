import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { schemaStatements } from "../schema";
import { runMigrations } from "./runner";

describe("runMigrations", () => {
  it("applies the ordered migrations exactly once", () => {
    const db = new Database(":memory:");

    try {
      expect(runMigrations(db).map((row) => row.id)).toEqual([
        "0001_initial",
        "0002_continuous_assistant"
      ]);
      expect(runMigrations(db).map((row) => row.id)).toEqual([
        "0001_initial",
        "0002_continuous_assistant"
      ]);

      const rows = db.prepare("SELECT id FROM schema_migrations").all();
      expect(rows).toEqual([
        { id: "0001_initial" },
        { id: "0002_continuous_assistant" }
      ]);

      const columns = db.prepare("PRAGMA table_info(assistant_turns)").all() as Array<{
        name: string;
      }>;
      expect(columns.map((column) => column.name)).toEqual(
        expect.arrayContaining(["idempotency_key", "context_pack_id", "assistant_event_id"])
      );
    } finally {
      db.close();
    }
  });

  it("adopts an existing MVP schema without deleting data", () => {
    const db = new Database(":memory:");

    try {
      for (const statement of schemaStatements) {
        db.exec(statement);
      }

      db.prepare(
        `INSERT INTO workspaces (
          id,
          name,
          kind,
          privacy_mode,
          created_at,
          updated_at
        ) VALUES (?, ?, 'project', 'standard', ?, ?)`
      ).run(
        "w_existing",
        "Existing",
        "2026-07-10T00:00:00.000Z",
        "2026-07-10T00:00:00.000Z"
      );

      runMigrations(db);

      expect(
        db.prepare("SELECT name FROM workspaces WHERE id = ?").pluck().get("w_existing")
      ).toBe("Existing");
      expect(db.prepare("SELECT COUNT(*) FROM schema_migrations").pluck().get()).toBe(2);
    } finally {
      db.close();
    }
  });
});
