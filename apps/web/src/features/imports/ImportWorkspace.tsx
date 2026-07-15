import { useEffect, useMemo, useRef, useState } from "react";
import type { FutureApi, ImportJobDto } from "../../app/api-types";
import { useImports } from "./use-imports";

// Mirrors the enforcement in apps/api/src/routes/v2/imports.ts. The API remains
// the source of truth; these values only power an early, accessible client-side
// rejection so users are not surprised after an upload round-trip.
const MAX_FILES = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

function formatMiB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MiB`;
}

/** Human, retry-independent explanation for a persisted import failure code. */
function explainError(job: ImportJobDto): string {
  switch (job.errorCode) {
    case "empty_source":
      return `${job.filename} has no readable content to import.`;
    case "unsupported_file":
      return `${job.filename} is not a supported file type.`;
    case "file_too_large":
      return `${job.filename} is larger than the ${formatMiB(MAX_FILE_BYTES)} per-file limit.`;
    case "parse_failed":
      return `${job.filename} could not be parsed.`;
    case "index_failed":
      return `${job.filename} could not be indexed. Retry to try again.`;
    default:
      return `${job.filename} failed to import (${job.errorCode?.replaceAll("_", " ") ?? "unknown error"}).`;
  }
}

/** Validates a browser selection against the documented limits before upload. */
function validateSelection(files: File[]): string | undefined {
  if (files.length > MAX_FILES) {
    return `Select at most ${MAX_FILES} files. You chose ${files.length}.`;
  }
  const oversized = files.find((file) => file.size > MAX_FILE_BYTES);
  if (oversized) {
    return `${oversized.name} is ${formatMiB(oversized.size)}, over the ${formatMiB(MAX_FILE_BYTES)} per-file limit.`;
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    return `The selection is ${formatMiB(total)}, over the ${formatMiB(MAX_TOTAL_BYTES)} per-request limit.`;
  }
  return undefined;
}

/** Concise live-region messages for state transitions, without page-level spam. */
function diffAnnouncements(previous: Map<string, string>, jobs: ImportJobDto[]): string[] {
  const messages: string[] = [];
  for (const job of jobs) {
    const before = previous.get(job.id);
    if (before === job.state) continue;
    if (job.state === "failed") {
      messages.push(`Import failed: ${job.filename}.`);
    } else if (job.state === "completed") {
      messages.push(`Import complete: ${job.filename}.`);
    } else if (job.state === "queued" && before === "failed") {
      messages.push(`Retrying import: ${job.filename}.`);
    }
  }
  return messages;
}

export function ImportWorkspace({ api, workspaceId }: { api: FutureApi; workspaceId: string }) {
  const imports = useImports(api, workspaceId);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [actionError, setActionError] = useState<string>();
  const [selectionError, setSelectionError] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>("");
  const previousStates = useRef(new Map<string, string>());

  const failedJobs = useMemo(() => imports.jobs.filter((job) => job.state === "failed"), [imports.jobs]);

  // Announce only genuine state transitions so polling does not repeat itself.
  useEffect(() => {
    const messages = diffAnnouncements(previousStates.current, imports.jobs);
    previousStates.current = new Map(imports.jobs.map((job) => [job.id, job.state]));
    if (messages.length > 0) {
      setStatusMessage(messages.join(" "));
    }
  }, [imports.jobs]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      setActionError(undefined);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Import action failed");
    }
  };

  const onSelect = (files: File[]) => {
    setSelectedFiles(files);
    setSelectionError(files.length > 0 ? validateSelection(files) : undefined);
  };

  const canSubmit = selectedFiles.length > 0 && !selectionError;

  return (
    <section className="main-column import-workspace" aria-label="Imports workspace">
      <header className="memory-toolbar">
        <div>
          <p className="eyebrow">Sources</p>
          <h2>Imports</h2>
          <p>Markdown, text, and ChatGPT exports</p>
        </div>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          void run(async () => {
            await imports.upload(selectedFiles);
            setSelectedFiles([]);
            setSelectionError(undefined);
          });
        }}
        className="import-picker"
      >
        <label>
          Choose import files
          <input
            aria-label="Choose import files"
            aria-describedby="import-limits"
            type="file"
            multiple
            accept=".md,.markdown,.txt,.json"
            onChange={(event) => onSelect(Array.from(event.target.files ?? []))}
          />
        </label>
        <p id="import-limits" className="import-limits">
          Up to {MAX_FILES} files · {formatMiB(MAX_FILE_BYTES)} per file · {formatMiB(MAX_TOTAL_BYTES)} per request.
        </p>
        <span>{selectedFiles.length} selected</span>
        <button type="submit" disabled={!canSubmit}>
          Import selected files
        </button>
      </form>
      {selectionError ? (
        <p role="alert" className="turn-error import-selection-error">
          {selectionError}
        </p>
      ) : null}
      {imports.status === "loading" ? <p>Loading imports...</p> : null}
      {imports.error || actionError ? (
        <p role="alert" className="turn-error">
          {imports.error ?? actionError}
        </p>
      ) : null}
      {failedJobs.length > 0 ? (
        <ul className="import-failures" aria-label="Import failures">
          {failedJobs.map((job) => (
            <li key={`error-${job.id}`}>{explainError(job)}</li>
          ))}
        </ul>
      ) : null}
      <p role="status" aria-live="polite" className="visually-hidden import-status">
        {statusMessage}
      </p>
      <div className="memory-list import-list">
        {imports.status === "ready" && imports.jobs.length === 0 ? <p>No files imported yet.</p> : null}
        {imports.jobs.map((job) => (
          <article className="memory-card" key={job.id}>
            <span>{job.state.replaceAll("_", " ")}</span>
            <strong>{job.filename}</strong>
            <small>
              {job.completedDocumentCount}/{job.documentCount} documents · chunk {job.nextChunkIndex}
            </small>
            {job.errorCode ? <p>{job.errorCode.replaceAll("_", " ")}</p> : null}
            {job.state === "failed" ? (
              <button
                type="button"
                aria-label={`Retry ${job.filename}`}
                onClick={() => void run(() => imports.retry(job.id))}
              >
                Retry
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
