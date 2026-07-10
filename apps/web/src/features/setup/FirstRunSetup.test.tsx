import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FutureApi } from "../../app/api-types";
import { FirstRunSetup } from "./FirstRunSetup";

describe("FirstRunSetup", () => {
  it("creates the missing workspace, provider, and model profile", async () => {
    const createWorkspace = vi.fn(async () => ({
      id: "w_new", name: "Personal", kind: "project", privacyMode: "local_only" as const,
      createdAt: "2026-07-10T00:00:00.000Z", updatedAt: "2026-07-10T00:00:00.000Z"
    }));
    const createProvider = vi.fn(async () => ({
      id: "prov_new", kind: "mock" as const, displayName: "Mock", isLocal: true,
      hasSecret: false, capabilities: { streaming: true, text: true, embeddings: false },
      createdAt: "2026-07-10T00:00:00.000Z", updatedAt: "2026-07-10T00:00:00.000Z"
    }));
    const createModelProfile = vi.fn(async () => ({
      id: "profile_new", providerId: "prov_new", name: "Default", model: "mock",
      contextWindow: 4096, purpose: "general", privacyPolicy: "local_only" as const,
      createdAt: "2026-07-10T00:00:00.000Z", updatedAt: "2026-07-10T00:00:00.000Z"
    }));
    const api = {
      createWorkspace,
      createProvider,
      createModelProfile
    } as unknown as FutureApi;
    const onComplete = vi.fn();

    render(
      <FirstRunSetup
        api={api}
        workspaces={[]}
        providers={[]}
        modelProfiles={[]}
        onComplete={onComplete}
      />
    );

    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Personal" } });
    fireEvent.change(screen.getByLabelText("Privacy"), { target: { value: "local_only" } });
    fireEvent.click(screen.getByRole("button", { name: "Create local assistant" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(createWorkspace).toHaveBeenCalledWith({ name: "Personal", privacyMode: "local_only" });
    expect(createProvider).toHaveBeenCalledWith(expect.objectContaining({ kind: "mock" }));
    expect(createModelProfile).toHaveBeenCalledWith(expect.objectContaining({
      providerId: "prov_new", model: "mock"
    }));
  });
});
