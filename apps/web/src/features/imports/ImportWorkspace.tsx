import { useState } from "react";
import type { FutureApi } from "../../app/api-types";
import { useImports } from "./use-imports";

export function ImportWorkspace({ api, workspaceId }: { api: FutureApi; workspaceId: string }) {
  const imports = useImports(api, workspaceId);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [actionError, setActionError] = useState<string>();

  const run = async (action: () => Promise<unknown>) => {
    try { await action(); setActionError(undefined); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Import action failed"); }
  };

  return (
    <section className="main-column import-workspace" aria-label="Imports workspace">
      <header className="memory-toolbar">
        <div><p className="eyebrow">Sources</p><h2>Imports</h2><p>Markdown, text, and ChatGPT exports</p></div>
      </header>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (selectedFiles.length === 0) return;
        void run(async () => { await imports.upload(selectedFiles); setSelectedFiles([]); });
      }} className="import-picker">
        <label>Choose import files
          <input aria-label="Choose import files" type="file" multiple accept=".md,.markdown,.txt,.json"
            onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))} />
        </label>
        <span>{selectedFiles.length} selected</span>
        <button type="submit" disabled={selectedFiles.length === 0}>Import selected files</button>
      </form>
      {imports.status === "loading" ? <p>Loading imports...</p> : null}
      {imports.error || actionError ? <p role="alert" className="turn-error">{imports.error ?? actionError}</p> : null}
      <div className="memory-list import-list">
        {imports.status === "ready" && imports.jobs.length === 0 ? <p>No files imported yet.</p> : null}
        {imports.jobs.map((job) => (
          <article className="memory-card" key={job.id}>
            <span>{job.state.replaceAll("_", " ")}</span>
            <strong>{job.filename}</strong>
            <small>{job.completedDocumentCount}/{job.documentCount} documents · chunk {job.nextChunkIndex}</small>
            {job.errorCode ? <p>{job.errorCode.replaceAll("_", " ")}</p> : null}
            {job.state === "failed" ? (
              <button type="button" aria-label={`Retry ${job.filename}`} onClick={() => void run(() => imports.retry(job.id))}>Retry</button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
