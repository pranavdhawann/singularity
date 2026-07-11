import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FutureApi, MemoryDto } from "../../app/api-types";
import { MemoryWorkspace } from "./MemoryWorkspace";

const memory: MemoryDto = { id: "mem_1", workspaceId: "w_1", type: "decision", statement: "Use a database",
  confidence: 0.9, reviewState: "proposed", pinned: false, version: 1, namespaceIds: [], sourceIds: ["evt_1"],
  contentHash: "mem_hash",
  createdAt: "2026-07-11T00:00:00.000Z", updatedAt: "2026-07-11T00:00:00.000Z" };

function api(): FutureApi {
  return { listMemories: vi.fn(async () => ({ items: [memory] })),
    listNamespaces: vi.fn(async () => ({ namespaces: [{ id: "ns_1", workspaceId: "w_1", name: "Coding",
      parentId: null, createdAt: memory.createdAt, updatedAt: memory.updatedAt }] })),
    getMemory: vi.fn(async () => memory), listMemoryRevisions: vi.fn(async () => ({ revisions: [{
      id: "rev_1", memoryId: memory.id, version: 1, previous: {}, next: { statement: memory.statement },
      reason: "created", createdAt: memory.createdAt }] })),
    updateMemory: vi.fn(async (_id, input) => ({ ...memory, ...input, version: 2 })),
    deleteMemory: vi.fn(async () => ({ ...memory, deletedAt: memory.updatedAt, version: 2 })),
    createMemory: vi.fn(async () => memory), createNamespace: vi.fn(), createCompaction: vi.fn(async () => ({
      id: "cmp_1", workspaceId: "w_1", summary: "Database decision", contentHash: "cmp_hash",
      sources: [{ kind: "memory", id: "mem_1", contentHash: "mem_hash" }], invalidatedAt: null,
      createdAt: memory.createdAt
    })),
  } as unknown as FutureApi;
}

describe("MemoryWorkspace", () => {
  it("filters, edits, assigns, and shows revisions", async () => {
    const client = api();
    render(<MemoryWorkspace api={client} workspaceId="w_1" />);
    expect(await screen.findByText("Use a database")).toBeInTheDocument();
    expect(screen.getByText("Review queue: 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use a database" }));
    expect(await screen.findByText("Revision history")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Memory statement"), { target: { value: "Use SQLite" } });
    fireEvent.click(screen.getByLabelText("Pinned"));
    fireEvent.change(screen.getByLabelText("Primary namespace"), { target: { value: "ns_1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save memory" }));
    await waitFor(() => expect(client.updateMemory).toHaveBeenCalledWith("mem_1", expect.objectContaining({
      expectedVersion: 1, statement: "Use SQLite", pinned: true, namespaceIds: ["ns_1"]
    })));
    fireEvent.change(screen.getByLabelText("Compaction summary"), { target: { value: "Database decision" } });
    fireEvent.click(screen.getByRole("button", { name: "Create compaction" }));
    await waitFor(() => expect(client.createCompaction).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "w_1", summary: "Database decision"
    })));
  });

  it("requires confirmation before delete", async () => {
    const client = api();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<MemoryWorkspace api={client} workspaceId="w_1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Use a database" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete memory" }));
    expect(client.deleteMemory).not.toHaveBeenCalled();
  });
});
