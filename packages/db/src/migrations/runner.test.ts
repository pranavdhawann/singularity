import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { schemaStatements } from "../schema";
import { initialMigration } from "./0001-initial";
import { continuousAssistantMigration } from "./0002-continuous-assistant";
import { runMigrations, validateMigrationOrder } from "./runner";

describe("runMigrations", () => {
  it("rejects duplicate or out-of-order migration IDs", () => {
    const migration = (id: string) => ({ id, checksum: `checksum-${id}`, up: () => undefined });

    expect(() => validateMigrationOrder([migration("0001_initial"), migration("0001_initial")])).toThrow(
      "Migration IDs must be strictly increasing: 0001_initial follows 0001_initial",
    );
    expect(() => validateMigrationOrder([migration("0002_second"), migration("0001_first")])).toThrow(
      "Migration IDs must be strictly increasing: 0001_first follows 0002_second",
    );
  });

  it("rejects a checksum mismatch for an applied migration", () => {
    const db = new Database(":memory:");
    try {
      runMigrations(db);
      db.prepare("UPDATE schema_migrations SET checksum = 'tampered' WHERE id = '0002_continuous_assistant'").run();

      expect(() => runMigrations(db)).toThrow("Migration checksum mismatch: 0002_continuous_assistant");
    } finally {
      db.close();
    }
  });

  it("applies the ordered migrations exactly once", () => {
    const db = new Database(":memory:");

    try {
      expect(runMigrations(db).map((row) => row.id)).toEqual([
        "0001_initial",
        "0002_continuous_assistant",
        "0003_memory_hybrid_retrieval",
        "0004_imports_external_models",
        "0005_workspace_settings",
      ]);
      expect(runMigrations(db).map((row) => row.id)).toEqual([
        "0001_initial",
        "0002_continuous_assistant",
        "0003_memory_hybrid_retrieval",
        "0004_imports_external_models",
        "0005_workspace_settings",
      ]);

      const rows = db.prepare("SELECT id FROM schema_migrations").all();
      expect(rows).toEqual([
        { id: "0001_initial" },
        { id: "0002_continuous_assistant" },
        { id: "0003_memory_hybrid_retrieval" },
        { id: "0004_imports_external_models" },
        { id: "0005_workspace_settings" },
      ]);

      const columns = db.prepare("PRAGMA table_info(assistant_turns)").all() as Array<{
        name: string;
      }>;
      expect(columns.map((column) => column.name)).toEqual(
        expect.arrayContaining(["idempotency_key", "context_pack_id", "assistant_event_id"]),
      );
      const profileColumns = db.prepare("PRAGMA table_info(model_profiles)").all() as Array<{ name: string }>;
      expect(profileColumns.map((column) => column.name)).toContain("embedding_model");

      const phase3Tables = db
        .prepare(
          `SELECT name FROM sqlite_master
         WHERE name IN (
           'memory_namespaces', 'memory_namespace_memberships',
           'memory_compaction_sources', 'source_embeddings',
           'memories_fts', 'events_fts', 'compactions_fts'
         ) ORDER BY name`,
        )
        .pluck()
        .all();
      expect(phase3Tables).toEqual([
        "compactions_fts",
        "events_fts",
        "memories_fts",
        "memory_compaction_sources",
        "memory_namespace_memberships",
        "memory_namespaces",
        "source_embeddings",
      ]);

      const phase4Tables = db
        .prepare(
          `SELECT name FROM sqlite_master
         WHERE name IN ('import_job_checkpoints', 'prompt_previews', 'prompt_decisions')
         ORDER BY name`,
        )
        .pluck()
        .all();
      expect(phase4Tables).toEqual(["import_job_checkpoints", "prompt_decisions", "prompt_previews"]);

      const modelCallColumns = db.prepare("PRAGMA table_info(model_calls)").all() as Array<{ name: string }>;
      expect(modelCallColumns.map((column) => column.name)).toEqual(
        expect.arrayContaining(["prompt_preview_id", "prompt_decision_id"]),
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
        ) VALUES (?, ?, 'project', 'standard', ?, ?)`,
      ).run("w_existing", "Existing", "2026-07-10T00:00:00.000Z", "2026-07-10T00:00:00.000Z");

      runMigrations(db);

      expect(db.prepare("SELECT name FROM workspaces WHERE id = ?").pluck().get("w_existing")).toBe("Existing");
      expect(db.prepare("SELECT COUNT(*) FROM schema_migrations").pluck().get()).toBe(5);
    } finally {
      db.close();
    }
  });

  it("preserves Phase 2 turns, packs, citations, and events during upgrade", () => {
    const db = new Database(":memory:");
    try {
      for (const statement of schemaStatements) db.exec(statement);
      continuousAssistantMigration.up(db);
      db.exec(`CREATE TABLE schema_migrations (
        id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL
      )`);
      const recordMigration = db.prepare("INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (?, ?, ?)");
      recordMigration.run(initialMigration.id, initialMigration.checksum, "2026-07-10T00:00:00.000Z");
      recordMigration.run(
        continuousAssistantMigration.id,
        continuousAssistantMigration.checksum,
        "2026-07-10T00:00:01.000Z",
      );
      db.prepare(`INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        "evt_1",
        "w_1",
        "user.message.created",
        "user",
        "Message",
        JSON.stringify({ text: "Remember SQLite" }),
        JSON.stringify({ labels: ["local"] }),
        "2026-07-11T00:00:00.000Z",
      );
      db.prepare(`INSERT INTO assistant_turns VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        "turn_1",
        "w_1",
        "profile_1",
        "key_1",
        "completed",
        "evt_1",
        "ctx_1",
        "call_1",
        "evt_answer",
        null,
        "2026-07-11T00:00:00.000Z",
        "2026-07-11T00:00:01.000Z",
      );
      db.prepare(`INSERT INTO context_packs VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        "ctx_1",
        "w_1",
        "evt_1",
        "profile_1",
        "{}",
        "[]",
        "[]",
        "2026-07-11T00:00:00.000Z",
      );
      db.prepare(`INSERT INTO assistant_response_sources VALUES (?, ?, ?, ?, ?)`).run(
        "evt_answer",
        "memory",
        "mem_1",
        "{}",
        0,
      );

      runMigrations(db);

      expect(db.prepare("SELECT id FROM assistant_turns").pluck().get()).toBe("turn_1");
      expect(db.prepare("SELECT id FROM context_packs").pluck().get()).toBe("ctx_1");
      expect(db.prepare("SELECT source_id FROM assistant_response_sources").pluck().get()).toBe("mem_1");
      expect(db.prepare("SELECT id FROM events").pluck().get()).toBe("evt_1");
      expect(db.prepare("SELECT COUNT(*) FROM events_fts").pluck().get()).toBe(1);
    } finally {
      db.close();
    }
  });
});
