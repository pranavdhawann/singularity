import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsDrawer } from "./SettingsDrawer";

afterEach(cleanup);

describe("SettingsDrawer", () => {
  it("renders section tabs and the active panel", () => {
    render(
      <SettingsDrawer onClose={vi.fn()}>
        {{ Providers: <p>providers panel</p>, Privacy: <p>privacy panel</p> }}
      </SettingsDrawer>,
    );
    expect(screen.getByRole("dialog", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText("providers panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Privacy" }));
    expect(screen.getByText("privacy panel")).toBeInTheDocument();
  });

  it("closes on Escape and on overlay click", () => {
    const onClose = vi.fn();
    render(<SettingsDrawer onClose={onClose}>{{ Providers: <p>x</p> }}</SettingsDrawer>);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("settings-overlay"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("focuses the first tab on open", () => {
    render(<SettingsDrawer onClose={vi.fn()}>{{ Providers: <p>x</p>, Privacy: <p>y</p> }}</SettingsDrawer>);
    expect(screen.getByRole("tab", { name: "Providers" })).toHaveFocus();
  });
});
