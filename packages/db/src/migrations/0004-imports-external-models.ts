import { createHash } from "node:crypto";
import type { Migration } from "./types";

const statements = [
  "ALTER TABLE imports ADD COLUMN filename TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE imports ADD COLUMN media_type TEXT NOT NULL DEFAULT 'application/octet-stream'",
  "ALTER TABLE imports ADD COLUMN byte_size INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE imports ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE imports ADD COLUMN document_count INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE imports ADD COLUMN completed_document_count INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE imports ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE imports ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE document_chunks ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE model_calls ADD COLUMN prompt_preview_id TEXT",
  "ALTER TABLE model_calls ADD COLUMN prompt_decision_id TEXT",
  `CREATE TABLE import_job_checkpoints (
    job_id TEXT PRIMARY KEY,
    import_id TEXT NOT NULL,
    document_index INTEGER NOT NULL DEFAULT 0,
    next_chunk_index INTEGER NOT NULL DEFAULT 0,
    phase TEXT NOT NULL DEFAULT 'queued',
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE import_payloads (
    import_id TEXT PRIMARY KEY,
    content BLOB NOT NULL
  )`,
  `CREATE UNIQUE INDEX documents_import_hash_idx
    ON documents (import_id, hash) WHERE import_id IS NOT NULL`,
  `CREATE UNIQUE INDEX document_chunks_identity_idx
    ON document_chunks (document_id, chunk_index, content_hash)`,
  `CREATE TABLE prompt_previews (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    turn_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    model_profile_id TEXT NOT NULL,
    model TEXT NOT NULL,
    endpoint_classification TEXT NOT NULL,
    context_pack_id TEXT NOT NULL,
    context_pack_hash TEXT NOT NULL,
    redacted_prompt TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    binding_hash TEXT NOT NULL,
    estimated_tokens INTEGER NOT NULL,
    privacy_labels_json TEXT NOT NULL,
    redaction_counts_json TEXT NOT NULL,
    selected_sources_json TEXT NOT NULL,
    excluded_sources_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    invalidated_at TEXT,
    UNIQUE (turn_id, binding_hash)
  )`,
  `CREATE INDEX prompt_previews_workspace_created_idx
    ON prompt_previews (workspace_id, created_at DESC)`,
  `CREATE TABLE prompt_decisions (
    id TEXT PRIMARY KEY,
    preview_id TEXT NOT NULL UNIQUE,
    decision TEXT NOT NULL,
    binding_hash TEXT NOT NULL,
    decided_at TEXT NOT NULL
  )`
] as const;

export const importsExternalModelsMigration: Migration = {
  id: "0004_imports_external_models",
  checksum: createHash("sha256").update(statements.join("\n")).digest("hex"),
  up(db) {
    for (const statement of statements) db.exec(statement);
  }
};
