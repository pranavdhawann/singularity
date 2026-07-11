import type { ImportJobDto } from "@future/core";
import { useCallback, useEffect, useState } from "react";
import type { FutureApi } from "../../app/api-types";

const terminalStates = new Set(["completed", "failed"]);

export function useImports(api: FutureApi, workspaceId: string) {
  const [jobs, setJobs] = useState<ImportJobDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const result = await api.listImports(workspaceId);
      setJobs(result.jobs);
      setStatus("ready");
      setError(undefined);
      return result.jobs;
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Imports could not be loaded");
      return [];
    }
  }, [api, workspaceId]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const next = await refresh();
      if (active && next?.some((job) => !terminalStates.has(job.state))) {
        timer = setTimeout(() => void poll(), 750);
      }
    };
    setStatus("loading");
    void poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [refresh]);

  const upload = useCallback(async (files: File[]) => {
    const result = await api.uploadImports(workspaceId, files);
    await refresh();
    return result;
  }, [api, refresh, workspaceId]);

  const retry = useCallback(async (id: string) => {
    const result = await api.retryImport(id);
    await refresh();
    return result.job;
  }, [api, refresh]);

  return { jobs, status, error, refresh, upload, retry };
}
