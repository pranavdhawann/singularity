import { createHash } from "node:crypto";
import type { Migration } from "./types";

const statements = [
  `CREATE TABLE assistant_turns (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    model_profile_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    state TEXT NOT NULL,
    user_event_id TEXT NOT NULL,
    context_pack_id TEXT,
    model_call_id TEXT,
    assistant_event_id TEXT,
    error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (workspace_id, idempotency_key)
  )`,
  `CREATE INDEX assistant_turns_workspace_created_idx
    ON assistant_turns (workspace_id, created_at DESC)`,
  `CREATE TABLE assistant_response_sources (
    event_id TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_json TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    PRIMARY KEY (event_id, source_kind, source_id)
  )`
] as const;

const checksum = createHash("sha256").update(statements.join("\n")).digest("hex");

export const continuousAssistantMigration: Migration = {
  id: "0002_continuous_assistant",
  checksum,
  up(db) {
    for (const statement of statements) {
      db.exec(statement);
    }
  }
};
