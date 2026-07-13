import { createHash } from "node:crypto";
import { createId, type ImportJobDto, type ImportJobState } from "@future/core";
import type { SqliteDatabase } from "../connection";

export interface CreateImportFileInput {
  workspaceId: string;
  filename: string;
  mediaType: string;
  kind: "text" | "markdown" | "chatgpt";
  content: Uint8Array;
}

export interface ImportCheckpointUpdate {
  state: ImportJobState;
  documentIndex?: number;
  nextChunkIndex?: number;
  documentCount?: number;
  completedDocumentCount?: number;
}

interface ImportJobRow {
  id: string;
  import_id: string;
  workspace_id: string;
  filename: string;
  media_type: string;
  byte_size: number;
  status: ImportJobState;
  document_index: number;
  next_chunk_index: number;
  document_count: number;
  completed_document_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export class ImportJobConflictError extends Error {
  constructor() {
    super("import job state changed");
    this.name = "ImportJobConflictError";
  }
}

export class ImportJobRepository {
  constructor(private readonly db: SqliteDatabase) {}

  createFile(input: CreateImportFileInput): ImportJobDto {
    const importId = createId("imp");
    const jobId = createId("job");
    const now = new Date().toISOString();
    const content = Buffer.from(input.content);
    const contentHash = createHash("sha256").update(content).digest("hex");
    const create = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO imports (
          id, workspace_id, kind, source_path, status, started_at, finished_at,
          error_message, filename, media_type, byte_size, content_hash,
          document_count, completed_document_count, retry_count, updated_at
        ) VALUES (
          @id, @workspaceId, @kind, @filename, 'queued', @now, NULL, NULL,
          @filename, @mediaType, @byteSize, @contentHash, 0, 0, 0, @now
        )`,
        )
        .run({ id: importId, ...input, byteSize: content.byteLength, contentHash, now });
      this.db
        .prepare(
          `INSERT INTO jobs (
          id, workspace_id, kind, status, input_json, result_json,
          error_message, created_at, started_at, finished_at
        ) VALUES (
          @id, @workspaceId, 'import', 'queued', @inputJson, NULL,
          NULL, @now, NULL, NULL
        )`,
        )
        .run({
          id: jobId,
          workspaceId: input.workspaceId,
          inputJson: JSON.stringify({
            importId,
            filename: input.filename,
            mediaType: input.mediaType,
            kind: input.kind,
          }),
          now,
        });
      this.db
        .prepare(
          `INSERT INTO import_job_checkpoints (
          job_id, import_id, document_index, next_chunk_index, phase, updated_at
        ) VALUES (@jobId, @importId, 0, 0, 'queued', @now)`,
        )
        .run({ jobId, importId, now });
      this.db.prepare("INSERT INTO import_payloads (import_id, content) VALUES (?, ?)").run(importId, content);
    });
    create();
    return this.get(jobId)!;
  }

  get(jobId: string): ImportJobDto | undefined {
    const row = this.db
      .prepare<{ jobId: string }, ImportJobRow>(
        `SELECT j.id, i.id AS import_id, i.workspace_id, i.filename, i.media_type,
        i.byte_size, j.status, c.document_index, c.next_chunk_index,
        i.document_count, i.completed_document_count, j.error_message,
        j.created_at, i.updated_at
       FROM jobs j
       JOIN import_job_checkpoints c ON c.job_id = j.id
       JOIN imports i ON i.id = c.import_id
       WHERE j.id = @jobId`,
      )
      .get({ jobId });
    return row ? mapImportJob(row) : undefined;
  }

  listForWorkspace(workspaceId: string): ImportJobDto[] {
    return this.db
      .prepare<{ workspaceId: string }, ImportJobRow>(
        `SELECT j.id, i.id AS import_id, i.workspace_id, i.filename, i.media_type,
        i.byte_size, j.status, c.document_index, c.next_chunk_index,
        i.document_count, i.completed_document_count, j.error_message,
        j.created_at, i.updated_at
       FROM jobs j
       JOIN import_job_checkpoints c ON c.job_id = j.id
       JOIN imports i ON i.id = c.import_id
       WHERE i.workspace_id = @workspaceId
       ORDER BY j.created_at DESC`,
      )
      .all({ workspaceId })
      .map(mapImportJob);
  }

  readPayload(importId: string): Buffer {
    const row = this.db
      .prepare<{ importId: string }, { content: Buffer }>(
        "SELECT content FROM import_payloads WHERE import_id = @importId",
      )
      .get({ importId });
    if (!row) throw new Error("import payload not found");
    return Buffer.from(row.content);
  }

  advance(jobId: string, expectedState: ImportJobState, update: ImportCheckpointUpdate): ImportJobDto {
    const current = this.get(jobId);
    if (!current || current.state !== expectedState) throw new ImportJobConflictError();
    const now = new Date().toISOString();
    const advance = this.db.transaction(() => {
      const changed = this.db
        .prepare(
          `UPDATE jobs SET status = @state, error_message = NULL,
          started_at = COALESCE(started_at, @now),
          finished_at = CASE WHEN @state = 'completed' THEN @now ELSE NULL END
         WHERE id = @jobId AND status = @expectedState`,
        )
        .run({ jobId, expectedState, state: update.state, now });
      if (changed.changes !== 1) throw new ImportJobConflictError();
      this.db
        .prepare(
          `UPDATE import_job_checkpoints SET
          document_index = @documentIndex, next_chunk_index = @nextChunkIndex,
          phase = @state, updated_at = @now WHERE job_id = @jobId`,
        )
        .run({
          jobId,
          documentIndex: update.documentIndex ?? current.documentIndex,
          nextChunkIndex: update.nextChunkIndex ?? current.nextChunkIndex,
          state: update.state,
          now,
        });
      this.db
        .prepare(
          `UPDATE imports SET status = @state,
          document_count = @documentCount,
          completed_document_count = @completedDocumentCount,
          error_message = NULL, updated_at = @now,
          finished_at = CASE WHEN @state = 'completed' THEN @now ELSE NULL END
         WHERE id = @importId`,
        )
        .run({
          importId: current.importId,
          state: update.state,
          documentCount: update.documentCount ?? current.documentCount,
          completedDocumentCount: update.completedDocumentCount ?? current.completedDocumentCount,
          now,
        });
    });
    advance();
    return this.get(jobId)!;
  }

  fail(jobId: string, errorCode: string): ImportJobDto {
    const current = this.get(jobId);
    if (!current) throw new ImportJobConflictError();
    const now = new Date().toISOString();
    const fail = this.db.transaction(() => {
      this.db
        .prepare("UPDATE jobs SET status = 'failed', error_message = @errorCode, finished_at = @now WHERE id = @jobId")
        .run({ jobId, errorCode, now });
      this.db
        .prepare("UPDATE import_job_checkpoints SET phase = 'failed', updated_at = @now WHERE job_id = @jobId")
        .run({ jobId, now });
      this.db
        .prepare(
          "UPDATE imports SET status = 'failed', error_message = @errorCode, finished_at = @now, updated_at = @now WHERE id = @importId",
        )
        .run({ importId: current.importId, errorCode, now });
    });
    fail();
    return this.get(jobId)!;
  }

  retry(jobId: string): ImportJobDto {
    const current = this.get(jobId);
    if (!current || current.state !== "failed") throw new ImportJobConflictError();
    const now = new Date().toISOString();
    const retry = this.db.transaction(() => {
      this.db
        .prepare(
          "UPDATE jobs SET status = 'queued', error_message = NULL, started_at = NULL, finished_at = NULL WHERE id = @jobId AND status = 'failed'",
        )
        .run({ jobId });
      this.db
        .prepare("UPDATE import_job_checkpoints SET phase = 'queued', updated_at = @now WHERE job_id = @jobId")
        .run({ jobId, now });
      this.db
        .prepare(
          `UPDATE imports SET status = 'queued', error_message = NULL,
          retry_count = retry_count + 1, finished_at = NULL, updated_at = @now
         WHERE id = @importId`,
        )
        .run({ importId: current.importId, now });
    });
    retry();
    return this.get(jobId)!;
  }
}

function mapImportJob(row: ImportJobRow): ImportJobDto {
  return {
    id: row.id,
    importId: row.import_id,
    workspaceId: row.workspace_id,
    filename: row.filename,
    mediaType: row.media_type,
    byteSize: row.byte_size,
    state: row.status,
    documentIndex: row.document_index,
    nextChunkIndex: row.next_chunk_index,
    documentCount: row.document_count,
    completedDocumentCount: row.completed_document_count,
    ...(row.error_message ? { errorCode: row.error_message } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
