import { createEvent, createId } from "@future/core";
import {
  chunkDocument,
  parseChatGptExport,
  parseMarkdownDocument,
  parseTextDocument,
  type ImportParseResult,
} from "@future/importers";
import { indexSearchChunk } from "@future/retrieval";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../server/dependencies";

interface ImportBody {
  workspaceId: string;
  kind: "text" | "markdown" | "chatgpt";
  title?: string;
  sourceUri?: string;
  sourcePath?: string;
  text?: string;
  exportJson?: unknown;
}

export async function registerImportRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  server.post<{ Body: ImportBody }>(
    "/api/imports",
    {
      schema: {
        body: {
          type: "object",
          required: ["workspaceId", "kind"],
          additionalProperties: true,
          properties: {
            workspaceId: { type: "string" },
            kind: { type: "string", enum: ["text", "markdown", "chatgpt"] },
            title: { type: "string" },
            sourceUri: { type: "string" },
            sourcePath: { type: "string" },
            text: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const result = parseImportBody(request.body);
      const importId = createId("imp");
      const jobId = createId("job");
      const now = new Date().toISOString();

      const runImport = deps.db.transaction(() => {
        deps.db
          .prepare(
            `INSERT INTO imports (
              id,
              workspace_id,
              kind,
              source_path,
              status,
              started_at,
              finished_at,
              error_message
            ) VALUES (
              @id,
              @workspaceId,
              @kind,
              @sourcePath,
              'completed',
              @startedAt,
              @finishedAt,
              NULL
            )`,
          )
          .run({
            id: importId,
            workspaceId: request.body.workspaceId,
            kind: request.body.kind,
            sourcePath: request.body.sourcePath ?? request.body.sourceUri ?? null,
            startedAt: now,
            finishedAt: now,
          });

        deps.db
          .prepare(
            `INSERT INTO jobs (
              id,
              workspace_id,
              kind,
              status,
              input_json,
              result_json,
              error_message,
              created_at,
              started_at,
              finished_at
            ) VALUES (
              @id,
              @workspaceId,
              'import',
              'completed',
              @inputJson,
              @resultJson,
              NULL,
              @createdAt,
              @startedAt,
              @finishedAt
            )`,
          )
          .run({
            id: jobId,
            workspaceId: request.body.workspaceId,
            inputJson: JSON.stringify({
              kind: request.body.kind,
              sourcePath: request.body.sourcePath,
              sourceUri: request.body.sourceUri,
            }),
            resultJson: JSON.stringify({ documentCount: result.documents.length }),
            createdAt: now,
            startedAt: now,
            finishedAt: now,
          });

        deps.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: request.body.workspaceId,
            type: "import.started",
            actor: "user",
            title: `Started ${request.body.kind} import`,
            payload: { importId, jobId },
            privacy: { labels: ["local"] },
          }),
        );

        for (const [documentIndex, document] of result.documents.entries()) {
          const documentId = createId("doc");
          const chunks = chunkDocument(document.text);

          chunks.forEach((chunk) => {
            indexSearchChunk(deps.db, {
              chunkId: createId("chunk"),
              documentId,
              workspaceId: request.body.workspaceId,
              importId,
              title: document.title,
              text: chunk.text,
              chunkIndex: chunk.chunkIndex,
              tokenCount: chunk.tokenCount,
              sourceRange: chunk.sourceRange,
              sourceUri: document.sourceUri,
              mediaType: document.mediaType,
              hash: document.hash,
            });
          });

          deps.events.appendInCurrentTransaction(
            createEvent({
              workspaceId: request.body.workspaceId,
              type: "document.imported",
              actor: "job",
              title: `Imported ${document.title}`,
              payload: {
                importId,
                documentId,
                documentIndex,
                chunkCount: chunks.length,
              },
              privacy: { labels: ["local"] },
            }),
          );
        }

        deps.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: request.body.workspaceId,
            type: "import.finished",
            actor: "job",
            title: `Finished ${request.body.kind} import`,
            payload: { importId, jobId, documentCount: result.documents.length },
            privacy: { labels: ["local"] },
          }),
        );
      });

      runImport();

      return reply.code(201).send({
        importId,
        jobId,
        documentCount: result.documents.length,
      });
    },
  );
}

function parseImportBody(body: ImportBody): ImportParseResult {
  if (body.kind === "chatgpt") {
    return parseChatGptExport(body.exportJson as Parameters<typeof parseChatGptExport>[0]);
  }

  const title = body.title ?? body.sourcePath ?? body.sourceUri ?? "Untitled import";
  const sourceUri = body.sourceUri ?? body.sourcePath ?? `manual://${encodeURIComponent(title)}`;
  const text = body.text ?? "";

  return body.kind === "markdown"
    ? parseMarkdownDocument({ title, sourceUri, text })
    : parseTextDocument({ title, sourceUri, text });
}
