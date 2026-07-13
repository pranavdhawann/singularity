import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FutureApi } from "../../app/api-types";
import { FirstRunSetup } from "./FirstRunSetup";

afterEach(cleanup);

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

  it("configures an external OpenAI-compatible profile with an environment secret", async () => {
    const createWorkspace = vi.fn(async () => ({ id: "w_1" }));
    const createProvider = vi.fn(async () => ({ id: "provider_external" }));
    const createModelProfile = vi.fn(async () => ({ id: "profile_external" }));
    const api = { createWorkspace, createProvider, createModelProfile } as unknown as FutureApi;
    render(<FirstRunSetup api={api} workspaces={[]} providers={[]} modelProfiles={[]} onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai-compatible" } });
    fireEvent.change(screen.getByLabelText("Base URL"), { target: { value: "http://127.0.0.1:4180/v1" } });
    fireEvent.change(screen.getByLabelText("Secret environment variable"), { target: { value: "FUTURE_TEST_OPENAI_KEY" } });
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "phase4-model" } });
    fireEvent.click(screen.getByRole("button", { name: "Create local assistant" }));

    await waitFor(() => expect(createProvider).toHaveBeenCalledWith({
      kind: "openai-compatible", displayName: "External OpenAI-compatible",
      baseUrl: "http://127.0.0.1:4180/v1", secretEnvironmentVariable: "FUTURE_TEST_OPENAI_KEY",
      isLocal: false
    }));
    expect(createModelProfile).toHaveBeenCalledWith(expect.objectContaining({
      model: "phase4-model", privacyPolicy: "prompt_preview"
    }));
  });
});
