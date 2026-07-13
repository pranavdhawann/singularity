import type { MemoryDto, MemoryMutationInput, MemoryNamespaceDto } from "@future/core";
import { useCallback, useEffect, useState } from "react";
import type { FutureApi } from "../../app/api-types";

export function useMemories(api: FutureApi, workspaceId: string) {
  const [memories, setMemories] = useState<MemoryDto[]>([]);
  const [namespaces, setNamespaces] = useState<MemoryNamespaceDto[]>([]);
  const [reviewState, setReviewState] = useState<string>("");
  const [namespaceId, setNamespaceId] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [memoryResult, namespaceResult] = await Promise.all([
        api.listMemories(workspaceId, {
          ...(reviewState ? { reviewState } : {}),
          ...(namespaceId ? { namespaceId } : {}),
        }),
        api.listNamespaces(workspaceId),
      ]);
      setMemories(memoryResult.items);
      setNamespaces(namespaceResult.namespaces);
      setStatus("ready");
      setError(undefined);
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Memory could not be loaded");
    }
  }, [api, namespaceId, reviewState, workspaceId]);

  useEffect(() => {
    setStatus("loading");
    void refresh();
  }, [refresh]);

  const update = useCallback(
    async (id: string, input: MemoryMutationInput) => {
      const memory = await api.updateMemory(id, input);
      await refresh();
      return memory;
    },
    [api, refresh],
  );
  const remove = useCallback(
    async (id: string, version: number) => {
      const memory = await api.deleteMemory(id, version);
      await refresh();
      return memory;
    },
    [api, refresh],
  );
  const create = useCallback(
    async (statement: string) => {
      const memory = await api.createMemory({
        workspaceId,
        type: "fact",
        statement,
        confidence: 1,
        reviewState: "proposed",
        sourceIds: [],
      });
      await refresh();
      return memory;
    },
    [api, refresh, workspaceId],
  );
  const createNamespace = useCallback(
    async (name: string) => {
      const namespace = await api.createNamespace({ workspaceId, name });
      await refresh();
      return namespace;
    },
    [api, refresh, workspaceId],
  );

  return {
    memories,
    namespaces,
    reviewState,
    setReviewState,
    namespaceId,
    setNamespaceId,
    status,
    error,
    refresh,
    update,
    remove,
    create,
    createNamespace,
  };
}
