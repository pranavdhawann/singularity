import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssistantComposer } from "./AssistantComposer";

describe("AssistantComposer", () => {
  it("submits trimmed text and exposes cancellation while streaming", () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<AssistantComposer status="idle" onSubmit={onSubmit} onCancel={onCancel} />);
    fireEvent.change(screen.getByLabelText("Message Future"), { target: { value: "  Hello Future  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledWith("Hello Future");

    rerender(<AssistantComposer status="streaming" onSubmit={onSubmit} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByLabelText("Message Future")).toBeDisabled();
  });
});
