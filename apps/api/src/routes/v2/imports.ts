import { apiError, type ImportJobDto } from "@future/core";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../../server/dependencies";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

interface ImportQuery {
  workspaceId?: string;
}

interface ImportParams {
  id: string;
}

type FileResult =
  { filename: string; job: ImportJobDto } | { filename: string; errorCode: "unsupported_file" | "file_too_large" };

export async function registerV2ImportRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  await server.register(multipart, {
    limits: { fileSize: MAX_FILE_BYTES, files: 10, parts: 20 },
  });

  server.post("/api/v2/imports", async (request, reply) => {
    let workspaceId: string | undefined;
    let totalBytes = 0;
    const files: FileResult[] = [];
    const queuedIds: string[] = [];

    try {
      for await (const part of request.parts()) {
        if (part.type === "field") {
          if (part.fieldname === "workspaceId" && typeof part.value === "string") {
            workspaceId = part.value;
          }
          continue;
        }

        const filename = part.filename || "unnamed";
        const kind = classifyFile(filename, part.mimetype);
        if (!kind) {
          part.file.resume();
          files.push({ filename, errorCode: "unsupported_file" });
          continue;
        }
        if (!workspaceId) {
          part.file.resume();
          return reply.code(400).send(apiError("validation_error", "workspaceId must precede files", request.id));
        }

        const content = await part.toBuffer();
        totalBytes += content.byteLength;
        if (part.file.truncated || totalBytes > MAX_TOTAL_BYTES) {
          files.push({ filename, errorCode: "file_too_large" });
          continue;
        }

        const job = deps.importService.enqueueFile({
          workspaceId,
          filename,
          mediaType: part.mimetype,
          kind,
          content,
        });
        queuedIds.push(job.id);
        files.push({ filename, job });
      }
    } catch (error) {
      if (isFileLimitError(error)) {
        return reply.code(413).send(apiError("validation_error", "Import file too large", request.id));
      }
      throw error;
    }

    if (!workspaceId || files.length === 0) {
      return reply.code(400).send(apiError("validation_error", "Import files required", request.id));
    }

    queueMicrotask(() => {
      for (const jobId of queuedIds) {
        void deps.importService.run(jobId).catch(() => undefined);
      }
    });

    const partial = files.some((file) => "errorCode" in file);
    return reply.code(partial ? 207 : 201).send({ files });
  });

  server.get<{ Querystring: ImportQuery }>("/api/v2/imports", async (request, reply) => {
    if (!request.query.workspaceId) {
      return reply.code(400).send(apiError("validation_error", "workspaceId is required", request.id));
    }
    return { jobs: deps.importJobs.listForWorkspace(request.query.workspaceId) };
  });

  server.get<{ Params: ImportParams }>("/api/v2/imports/:id", async (request, reply) => {
    const job = deps.importJobs.get(request.params.id);
    return job ?? reply.code(404).send(apiError("not_found", "Import job not found", request.id));
  });

  server.post<{ Params: ImportParams }>("/api/v2/imports/:id/retry", async (request, reply) => {
    const existing = deps.importJobs.get(request.params.id);
    if (!existing) {
      return reply.code(404).send(apiError("not_found", "Import job not found", request.id));
    }
    if (existing.state !== "failed") {
      return reply.code(409).send(apiError("conflict", "Import job is not retryable", request.id));
    }
    const job = deps.importService.retry(existing.id);
    queueMicrotask(() => void deps.importService.run(job.id).catch(() => undefined));
    return reply.code(202).send({ job });
  });
}

function classifyFile(filename: string, mediaType: string): "text" | "markdown" | "chatgpt" | undefined {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return mediaType === "text/markdown" || mediaType === "text/plain" ? "markdown" : undefined;
  }
  if (lower.endsWith(".txt")) return mediaType === "text/plain" ? "text" : undefined;
  if (lower.endsWith(".json")) return mediaType === "application/json" ? "chatgpt" : undefined;
  return undefined;
}

function isFileLimitError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE",
  );
}
