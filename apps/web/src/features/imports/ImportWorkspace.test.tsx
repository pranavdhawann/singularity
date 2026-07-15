import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FutureApi, ImportJobDto } from "../../app/api-types";
import { ImportWorkspace } from "./ImportWorkspace";

afterEach(cleanup);

const baseJob: ImportJobDto = {
  id: "job_1",
  importId: "import_1",
  workspaceId: "w_1",
  filename: "notes.md",
  mediaType: "text/markdown",
  byteSize: 20,
  state: "queued",
  documentIndex: 0,
  nextChunkIndex: 0,
  documentCount: 1,
  completedDocumentCount: 0,
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:01.000Z",
};

const failedJob: ImportJobDto = {
  ...baseJob,
  state: "failed",
  nextChunkIndex: 1,
  errorCode: "index_failed",
};

function sizedFile(name: string, bytes: number, type = "text/plain"): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

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

  it("shows the documented import limits beside the picker", async () => {
    const api = { listImports: vi.fn(async () => ({ jobs: [] })) } as unknown as FutureApi;
    render(<ImportWorkspace api={api} workspaceId="w_1" />);

    const limits = await screen.findByText(/Up to 10 files/);
    expect(limits).toHaveTextContent("25 MiB per file");
    expect(limits).toHaveTextContent("50 MiB per request");
    expect(screen.getByLabelText("Choose import files")).toHaveAttribute("aria-describedby", "import-limits");
  });

  it("rejects an oversized browser selection before uploading", async () => {
    const uploadImports = vi.fn();
    const api = { listImports: vi.fn(async () => ({ jobs: [] })), uploadImports } as unknown as FutureApi;
    render(<ImportWorkspace api={api} workspaceId="w_1" />);

    const oversized = sizedFile("huge.md", 26 * 1024 * 1024, "text/markdown");
    fireEvent.change(await screen.findByLabelText("Choose import files"), { target: { files: [oversized] } });

    expect(screen.getByRole("alert")).toHaveTextContent(/over the 25 MiB per-file limit/);
    expect(screen.getByRole("button", { name: "Import selected files" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Import selected files" }));
    expect(uploadImports).not.toHaveBeenCalled();
  });

  it("explains an empty-source failure with the filename in the UI", async () => {
    const emptyJob: ImportJobDto = { ...failedJob, filename: "blank.md", errorCode: "empty_source" };
    const api = { listImports: vi.fn(async () => ({ jobs: [emptyJob] })) } as unknown as FutureApi;
    render(<ImportWorkspace api={api} workspaceId="w_1" />);

    const failures = await screen.findByLabelText("Import failures");
    expect(failures).toHaveTextContent("blank.md has no readable content to import.");
  });

  it("announces import completion in a polite live region without repeating on poll", async () => {
    const listImports = vi
      .fn()
      .mockResolvedValueOnce({ jobs: [baseJob] })
      .mockResolvedValue({ jobs: [{ ...baseJob, state: "completed" }] });
    const api = { listImports } as unknown as FutureApi;
    render(<ImportWorkspace api={api} workspaceId="w_1" />);

    const status = await screen.findByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Import complete: notes.md."), { timeout: 3000 });
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
