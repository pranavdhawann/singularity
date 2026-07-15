import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FutureApi } from "../../app/api-types";
import { PrivacyPanel } from "./PrivacyPanel";

afterEach(cleanup);

function buildApi(overrides: Partial<FutureApi> = {}): FutureApi {
  return {
    getSettings: vi.fn(async () => ({ redactLocalToo: false, autoCapture: true })),
    updateSettings: vi.fn(async (input) => ({
      redactLocalToo: input.redactLocalToo ?? false,
      autoCapture: input.autoCapture ?? true,
    })),
    ...overrides,
  } as unknown as FutureApi;
}

describe("PrivacyPanel", () => {
  it("loads settings on mount and renders labeled toggles", async () => {
    const api = buildApi();
    render(<PrivacyPanel api={api} workspaceId="w_1" />);

    await waitFor(() => expect(api.getSettings).toHaveBeenCalledWith("w_1"));
    expect(await screen.findByLabelText(/redact local/i)).not.toBeChecked();
    expect(screen.getByLabelText(/auto.?capture/i)).toBeChecked();
  });

  it("calls updateSettings when a toggle is flipped", async () => {
    const api = buildApi();
    render(<PrivacyPanel api={api} workspaceId="w_1" />);

    const redactToggle = await screen.findByLabelText(/redact local/i);
    fireEvent.click(redactToggle);

    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith({ workspaceId: "w_1", redactLocalToo: true }),
    );
  });
});
