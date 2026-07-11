import type { TimelineEventDto } from "@future/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FutureApi } from "../../app/api-types";

export type TimelineStatus = "loading" | "ready" | "error";

export function useTimeline(api: FutureApi, workspaceId: string) {
  const [events, setEvents] = useState<TimelineEventDto[]>([]);
  const [status, setStatus] = useState<TimelineStatus>("loading");
  const [error, setError] = useState<string | undefined>(undefined);
  const cursor = useRef<string | undefined>(undefined);
  const loading = useRef(false);

  const load = useCallback(async (reset = false) => {
    if (!workspaceId || loading.current) return;
    loading.current = true;
    try {
      const response = await api.listTimeline(workspaceId, reset ? undefined : cursor.current);
      if (reset) {
        setEvents(response.events);
      } else {
        setEvents((current) => mergeEvents(current, response.events));
      }
      if (response.nextCursor) cursor.current = response.nextCursor;
      setStatus("ready");
      setError(undefined);
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Timeline could not be loaded");
    } finally {
      loading.current = false;
    }
  }, [api, workspaceId]);

  useEffect(() => {
    cursor.current = undefined;
    setEvents([]);
    setStatus("loading");
    void load(true);
    const timer = window.setInterval(() => void load(), 750);
    return () => window.clearInterval(timer);
  }, [load]);

  return {
    events,
    status,
    error,
    refresh: useCallback(() => load(), [load])
  };
}

function mergeEvents(
  current: TimelineEventDto[],
  incoming: TimelineEventDto[]
): TimelineEventDto[] {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
}
