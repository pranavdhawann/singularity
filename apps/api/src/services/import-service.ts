import { createHash } from "node:crypto";
import { createEvent, type ImportJobDto } from "@future/core";
import {
  type EventRepository,
  type ImportJobRepository,
  type SqliteDatabase
} from "@future/db";
import {
  chunkDocument,
  parseChatGptExport,
  parseMarkdownDocument,
  parseTextDocument,
  type ImportParseResult
} from "@future/importers";
import { indexSearchChunk } from "@future/retrieval";

interface ImportServiceDependencies {
  db: SqliteDatabase;
  jobs: ImportJobRepository;
  events: EventRepository;
  failAfterChunks?: number;
}

interface RunImportHooks {
  afterChunkCommitted?: () => void;
}

export interface EnqueueImportFileInput {
  workspaceId: string;
  filename: string;
  mediaType: string;
  kind: "text" | "markdown" | "chatgpt";
  content: Uint8Array;
}

export class ImportServiceError extends Error {
  constructor(readonly code: "parse_failed" | "index_failed") {
    super(code.replace("_", " "));
    this.name = "ImportServiceError";
  }
}

export class ImportService {
  private readonly interruptedJobs = new Set<string>();

  constructor(private readonly dependencies: ImportServiceDependencies) {}

  enqueueFile(input: EnqueueImportFileInput): ImportJobDto {
    const job = this.dependencies.jobs.createFile(input);
    this.dependencies.events.append(createEvent({
      workspaceId: input.workspaceId,
      type: "import.started",
      actor: "user",
      title: `Started import of ${input.filename}`,
      payload: { importId: job.importId, jobId: job.id, filename: input.filename },
      privacy: { labels: ["local"] }
    }));
    return job;
  }

  retry(jobId: string): ImportJobDto {
    return this.dependencies.jobs.retry(jobId);
  }

  async run(jobId: string, hooks: RunImportHooks = {}): Promise<ImportJobDto> {
    const queued = this.dependencies.jobs.get(jobId);
    if (!queued || queued.state !== "queued") throw new Error("import job is not queued");

    let parsed: ImportParseResult;
    let committedChunks = 0;
    try {
      parsed = this.parse(queued);
      this.dependencies.jobs.advance(jobId, "queued", {
        state: "parsing",
        documentCount: parsed.documents.length
      });
    } catch (error) {
      this.dependencies.jobs.fail(jobId, "parse_failed");
      throw error instanceof ImportServiceError ? error : new ImportServiceError("parse_failed");
    }

    let checkpoint = this.dependencies.jobs.advance(jobId, "parsing", {
      state: "indexing",
      documentCount: parsed.documents.length
    });

    try {
      for (let documentIndex = checkpoint.documentIndex; documentIndex < parsed.documents.length; documentIndex += 1) {
        const document = parsed.documents[documentIndex]!;
        const documentId = stableId("doc", `${checkpoint.importId}:${document.sourceUri}:${document.hash}`);
        const chunks = chunkDocument(document.text);
        const firstChunk = documentIndex === checkpoint.documentIndex ? checkpoint.nextChunkIndex : 0;

        for (let chunkIndex = firstChunk; chunkIndex < chunks.length; chunkIndex += 1) {
          const chunk = chunks[chunkIndex]!;
          const contentHash = sha256(chunk.text);
          const persistChunk = this.dependencies.db.transaction(() => {
            indexSearchChunk(this.dependencies.db, {
              chunkId: stableId("chunk", `${documentId}:${chunk.chunkIndex}:${contentHash}`),
              documentId,
              workspaceId: checkpoint.workspaceId,
              importId: checkpoint.importId,
              title: document.title,
              text: chunk.text,
              chunkIndex: chunk.chunkIndex,
              tokenCount: chunk.tokenCount,
              sourceRange: chunk.sourceRange,
              sourceUri: document.sourceUri,
              mediaType: document.mediaType,
              hash: document.hash,
              contentHash
            });
            checkpoint = this.dependencies.jobs.advance(jobId, "indexing", {
              state: "indexing",
              documentIndex,
              nextChunkIndex: chunkIndex + 1
            });
          });
          persistChunk();
          committedChunks += 1;
          if (hooks.afterChunkCommitted) {
            hooks.afterChunkCommitted();
          } else if (
            this.dependencies.failAfterChunks &&
            committedChunks >= this.dependencies.failAfterChunks &&
            !this.interruptedJobs.has(jobId)
          ) {
            this.interruptedJobs.add(jobId);
            throw new Error("configured import interruption");
          }
        }

        const finishDocument = this.dependencies.db.transaction(() => {
          this.dependencies.events.appendInCurrentTransaction(createEvent({
            workspaceId: checkpoint.workspaceId,
            type: "document.imported",
            actor: "job",
            title: `Imported ${document.title}`,
            payload: { importId: checkpoint.importId, documentId, documentIndex, chunkCount: chunks.length },
            privacy: { labels: ["local"] }
          }));
          checkpoint = this.dependencies.jobs.advance(jobId, "indexing", {
            state: "indexing",
            documentIndex: documentIndex + 1,
            nextChunkIndex: 0,
            completedDocumentCount: documentIndex + 1
          });
        });
        finishDocument();
      }

      const complete = this.dependencies.db.transaction(() => {
        checkpoint = this.dependencies.jobs.advance(jobId, "indexing", {
          state: "completed",
          documentIndex: parsed.documents.length,
          nextChunkIndex: 0,
          completedDocumentCount: parsed.documents.length
        });
        this.dependencies.events.appendInCurrentTransaction(createEvent({
          workspaceId: checkpoint.workspaceId,
          type: "import.finished",
          actor: "job",
          title: `Finished import of ${checkpoint.filename}`,
          payload: {
            importId: checkpoint.importId,
            jobId: checkpoint.id,
            documentCount: parsed.documents.length
          },
          privacy: { labels: ["local"] }
        }));
      });
      complete();
      return checkpoint;
    } catch (error) {
      this.dependencies.jobs.fail(jobId, "index_failed");
      throw error instanceof Error ? error : new ImportServiceError("index_failed");
    }
  }

  private parse(job: ImportJobDto): ImportParseResult {
    const text = this.dependencies.jobs.readPayload(job.importId).toString("utf8");
    const kind = inferKind(job.filename, job.mediaType);
    if (kind === "chatgpt") {
      return parseChatGptExport(JSON.parse(text) as Parameters<typeof parseChatGptExport>[0]);
    }
    const input = {
      title: job.filename,
      sourceUri: `import://${encodeURIComponent(job.filename)}`,
      text
    };
    return kind === "markdown" ? parseMarkdownDocument(input) : parseTextDocument(input);
  }
}

function inferKind(filename: string, mediaType: string): "text" | "markdown" | "chatgpt" {
  if (filename.toLowerCase().endsWith(".json") || mediaType === "application/json") return "chatgpt";
  if (/\.md|\.markdown$/i.test(filename) || mediaType === "text/markdown") return "markdown";
  return "text";
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${sha256(value).slice(0, 24)}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
