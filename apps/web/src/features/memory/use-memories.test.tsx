import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FutureApi, MemoryDto } from "../../app/api-types";
import { useMemories } from "./use-memories";

const memory: MemoryDto = {
  id: "mem_1",
  workspaceId: "w_1",
  type: "fact",
  statement: "Use SQLite",
  confidence: 1,
  reviewState: "proposed",
  pinned: false,
  version: 1,
  namespaceIds: [],
  sourceIds: [],
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z",
};

describe("useMemories", () => {
  it("loads workspace state and refreshes after optimistic mutation", async () => {
    const listMemories = vi.fn(async () => ({ items: [memory] }));
    const api = {
      listMemories,
      listNamespaces: vi.fn(async () => ({ namespaces: [] })),
      updateMemory: vi.fn(async () => ({ ...memory, pinned: true, version: 2 })),
      getMemory: vi.fn(async () => memory),
      listMemoryRevisions: vi.fn(async () => ({ revisions: [] })),
    } as unknown as FutureApi;
    const { result } = renderHook(() => useMemories(api, "w_1"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.memories).toEqual([memory]);
    await act(async () => {
      await result.current.update(memory.id, { expectedVersion: 1, pinned: true, reason: "user_edit" });
    });
    expect(api.updateMemory).toHaveBeenCalled();
    expect(listMemories).toHaveBeenCalledTimes(2);
  });
});
