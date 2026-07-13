import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TimelineView } from "./TimelineView";

describe("TimelineView", () => {
  it("renders persisted messages, transient streaming text, and selectable citations", () => {
    const onContextSelected = vi.fn();
    render(
      <TimelineView
        events={[
          {
            id: "evt_user",
            workspaceId: "w_1",
            type: "user.message.created",
            actor: "user",
            title: "Message",
            payload: { text: "Hello" },
            privacy: {},
            createdAt: "2026-07-10T12:00:00.000Z",
            citations: [],
          },
          {
            id: "evt_answer",
            workspaceId: "w_1",
            type: "assistant.response.created",
            actor: "assistant",
            title: "Answer",
            payload: { responseText: "Hi", contextPackId: "ctx_1" },
            privacy: {},
            createdAt: "2026-07-10T12:01:00.000Z",
            citations: [
              { kind: "timeline_event", id: "evt_user", workspaceId: "w_1", title: "Message", contentHash: "abc" },
            ],
          },
        ]}
        streamedText="Still thinking"
        onContextSelected={onContextSelected}
      />,
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByText("Still thinking")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Citation 1: Message" }));
    expect(onContextSelected).toHaveBeenCalledWith("ctx_1");
  });
});
