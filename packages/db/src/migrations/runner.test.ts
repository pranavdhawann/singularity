import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { schemaStatements } from "../schema";
import { runMigrations } from "./runner";

describe("runMigrations", () => {
  it("applies the baseline exactly once", () => {
    const db = new Database(":memory:");

    try {
      expect(runMigrations(db).map((row) => row.id)).toEqual(["0001_initial"]);
      expect(runMigrations(db).map((row) => row.id)).toEqual(["0001_initial"]);

      const rows = db.prepare("SELECT id FROM schema_migrations").all();
      expect(rows).toEqual([{ id: "0001_initial" }]);
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
    } finally {
      db.close();
    }
  });
});
