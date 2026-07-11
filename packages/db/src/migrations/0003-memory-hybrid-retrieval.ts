import { createHash } from "node:crypto";
import type { Migration } from "./types";

const statements = [
  "ALTER TABLE memories ADD COLUMN version INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE memories ADD COLUMN deleted_at TEXT",
  "ALTER TABLE memories ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE compactions ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE compactions ADD COLUMN invalidated_at TEXT",
  `CREATE TABLE memory_namespaces (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (workspace_id, parent_id, name)
  )`,
  `CREATE INDEX memory_namespaces_workspace_parent_idx
    ON memory_namespaces (workspace_id, parent_id, name)`,
  `CREATE TABLE memory_namespace_memberships (
    memory_id TEXT NOT NULL,
    namespace_id TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    PRIMARY KEY (memory_id, namespace_id)
  )`,
  `CREATE UNIQUE INDEX memory_one_primary_namespace_idx
    ON memory_namespace_memberships (memory_id) WHERE is_primary = 1`,
  `CREATE TABLE memory_compaction_sources (
    compaction_id TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    source_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    PRIMARY KEY (compaction_id, source_kind, source_id)
  )`,
  `CREATE TABLE source_embeddings (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    source_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    adapter TEXT NOT NULL,
    model TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    vector_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (source_kind, source_id, content_hash, adapter, model)
  )`,
  `CREATE INDEX source_embeddings_workspace_source_idx
    ON source_embeddings (workspace_id, source_kind, source_id)`,
  `CREATE VIRTUAL TABLE memories_fts USING fts5(memory_id UNINDEXED, statement)`,
  `CREATE VIRTUAL TABLE events_fts USING fts5(event_id UNINDEXED, title, text)`,
  `INSERT INTO memories_fts (memory_id, statement)
    SELECT id, statement FROM memories
    WHERE review_state = 'approved' AND outdated_at IS NULL AND deleted_at IS NULL`,
  `INSERT INTO events_fts (event_id, title, text)
    SELECT id, title, payload_json FROM events`,
  `CREATE TRIGGER memories_fts_insert AFTER INSERT ON memories
    WHEN NEW.review_state = 'approved' AND NEW.outdated_at IS NULL AND NEW.deleted_at IS NULL
    BEGIN
      INSERT INTO memories_fts (memory_id, statement) VALUES (NEW.id, NEW.statement);
    END`,
  `CREATE TRIGGER memories_fts_update AFTER UPDATE ON memories
    BEGIN
      DELETE FROM memories_fts WHERE memory_id = OLD.id;
      INSERT INTO memories_fts (memory_id, statement)
        SELECT NEW.id, NEW.statement
        WHERE NEW.review_state = 'approved' AND NEW.outdated_at IS NULL AND NEW.deleted_at IS NULL;
    END`,
  `CREATE TRIGGER memories_fts_delete AFTER DELETE ON memories
    BEGIN
      DELETE FROM memories_fts WHERE memory_id = OLD.id;
    END`,
  `CREATE TRIGGER events_fts_insert AFTER INSERT ON events
    BEGIN
      INSERT INTO events_fts (event_id, title, text) VALUES (NEW.id, NEW.title, NEW.payload_json);
    END`,
  `CREATE TRIGGER events_fts_update AFTER UPDATE ON events
    BEGIN
      DELETE FROM events_fts WHERE event_id = OLD.id;
      INSERT INTO events_fts (event_id, title, text) VALUES (NEW.id, NEW.title, NEW.payload_json);
    END`,
  `CREATE TRIGGER events_fts_delete AFTER DELETE ON events
    BEGIN
      DELETE FROM events_fts WHERE event_id = OLD.id;
    END`
] as const;

export const memoryHybridRetrievalMigration: Migration = {
  id: "0003_memory_hybrid_retrieval",
  checksum: createHash("sha256").update(statements.join("\n")).digest("hex"),
  up(db) {
    for (const statement of statements) db.exec(statement);
  }
};
