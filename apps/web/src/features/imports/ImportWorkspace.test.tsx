import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FutureApi, ImportJobDto } from "../../app/api-types";
import { ImportWorkspace } from "./ImportWorkspace";

const failedJob: ImportJobDto = {
  id: "job_1",
  importId: "import_1",
  workspaceId: "w_1",
  filename: "notes.md",
  mediaType: "text/markdown",
  byteSize: 20,
  state: "failed",
  documentIndex: 0,
  nextChunkIndex: 1,
  documentCount: 1,
  completedDocumentCount: 0,
  errorCode: "index_failed",
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:01.000Z",
};

describe("ImportWorkspace", () => {
  it("restores persisted failures, uploads files, and retries only the selected job", async () => {
    const listImports = vi.fn(async () => ({ jobs: [failedJob] }));
    const uploadImports = vi.fn(async () => ({ files: [] }));
    const retryImport = vi.fn(async () => ({ job: { ...failedJob, state: "queued" as const } }));
    const api = { listImports, uploadImports, retryImport } as unknown as FutureApi;
    render(<ImportWorkspace api={api} workspaceId="w_1" />);

    expect(await screen.findByText("notes.md")).toBeInTheDocument();
    expect(screen.getByText("index failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry notes.md" }));
    await waitFor(() => expect(retryImport).toHaveBeenCalledWith("job_1"));

    const file = new File(["local"], "local.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Choose import files"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Import selected files" }));
    await waitFor(() => expect(uploadImports).toHaveBeenCalledWith("w_1", [file]));
  });
});
