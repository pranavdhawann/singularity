import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FutureApi } from "../../app/api-types";
import { useTimeline } from "./use-timeline";

describe("useTimeline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads SQLite events and polls from the last cursor without duplicates", async () => {
    vi.useFakeTimers();
    const first = {
      id: "evt_1",
      workspaceId: "w_1",
      type: "workspace.created",
      actor: "user" as const,
      title: "Created",
      payload: {},
      privacy: {},
      createdAt: "2026-07-10T12:00:00.000Z",
      citations: [],
    };
    const second = {
      ...first,
      id: "evt_2",
      type: "user.message.created",
      title: "Message",
      createdAt: "2026-07-10T12:01:00.000Z",
    };
    const listTimeline = vi
      .fn()
      .mockResolvedValueOnce({ events: [first], nextCursor: first.id })
      .mockResolvedValueOnce({ events: [second], nextCursor: second.id });
    const api = { listTimeline } as unknown as FutureApi;
    const { result } = renderHook(() => useTimeline(api, "w_1"));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.events.map((event) => event.id)).toEqual(["evt_1"]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750);
    });
    expect(listTimeline).toHaveBeenLastCalledWith("w_1", "evt_1");
    expect(result.current.events.map((event) => event.id)).toEqual(["evt_1", "evt_2"]);
  });
});
