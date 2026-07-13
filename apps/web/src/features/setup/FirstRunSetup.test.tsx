import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FutureApi } from "../../app/api-types";
import { FirstRunSetup } from "./FirstRunSetup";

afterEach(cleanup);

describe("FirstRunSetup", () => {
  it("creates the missing workspace, provider, and model profile", async () => {
    const createWorkspace = vi.fn(async () => ({
      id: "w_new",
      name: "Personal",
      kind: "project",
      privacyMode: "local_only" as const,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
    }));
    const createProvider = vi.fn(async () => ({
      id: "prov_new",
      kind: "mock" as const,
      displayName: "Mock",
      isLocal: true,
      hasSecret: false,
      capabilities: { streaming: true, text: true, embeddings: false },
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
    }));
    const createModelProfile = vi.fn(async () => ({
      id: "profile_new",
      providerId: "prov_new",
      name: "Default",
      model: "mock",
      contextWindow: 4096,
      purpose: "general",
      privacyPolicy: "local_only" as const,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
    }));
    const api = {
      createWorkspace,
      createProvider,
      createModelProfile,
    } as unknown as FutureApi;
    const onComplete = vi.fn();

    render(<FirstRunSetup api={api} workspaces={[]} providers={[]} modelProfiles={[]} onComplete={onComplete} />);

    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Personal" } });
    fireEvent.change(screen.getByLabelText("Privacy"), { target: { value: "local_only" } });
    fireEvent.click(screen.getByRole("button", { name: "Create local assistant" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(createWorkspace).toHaveBeenCalledWith({ name: "Personal", privacyMode: "local_only" });
    expect(createProvider).toHaveBeenCalledWith(expect.objectContaining({ kind: "mock" }));
    expect(createModelProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "prov_new",
        model: "mock",
      }),
    );
  });

  it("configures an external OpenAI-compatible profile with an environment secret", async () => {
    const createWorkspace = vi.fn(async () => ({ id: "w_1" }));
    const createProvider = vi.fn(async () => ({ id: "provider_external" }));
    const createModelProfile = vi.fn(async () => ({ id: "profile_external" }));
    const testProviderConnection = vi.fn(async () => ({ status: "ok" as const, models: ["phase4-model"] }));
    const api = { createWorkspace, createProvider, createModelProfile, testProviderConnection } as unknown as FutureApi;
    render(<FirstRunSetup api={api} workspaces={[]} providers={[]} modelProfiles={[]} onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai-compatible" } });
    fireEvent.change(screen.getByLabelText("Base URL"), { target: { value: "http://127.0.0.1:4180/v1" } });
    fireEvent.change(screen.getByLabelText("Secret environment variable"), {
      target: { value: "FUTURE_TEST_OPENAI_KEY" },
    });
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "phase4-model" } });
    fireEvent.click(screen.getByRole("button", { name: "Create local assistant" }));

    await waitFor(() =>
      expect(createProvider).toHaveBeenCalledWith({
        kind: "openai-compatible",
        displayName: "External OpenAI-compatible",
        baseUrl: "http://127.0.0.1:4180/v1",
        secretEnvironmentVariable: "FUTURE_TEST_OPENAI_KEY",
        isLocal: false,
      }),
    );
    expect(createModelProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "phase4-model",
        privacyPolicy: "prompt_preview",
      }),
    );
    expect(testProviderConnection).toHaveBeenCalledTimes(1);
  });

  it("tests an external connection without persisting setup", async () => {
    const testProviderConnection = vi.fn(async () => ({ status: "ok" as const, models: ["model-a"] }));
    const createWorkspace = vi.fn(async () => ({ id: "w_1" }));
    const createProvider = vi.fn(async () => ({ id: "provider_external" }));
    const createModelProfile = vi.fn(async () => ({ id: "profile_external" }));
    const api = { testProviderConnection, createWorkspace, createProvider, createModelProfile } as unknown as FutureApi;

    render(<FirstRunSetup api={api} workspaces={[]} providers={[]} modelProfiles={[]} onComplete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai-compatible" } });
    fireEvent.change(screen.getByLabelText("Secret environment variable"), {
      target: { value: "FUTURE_TEST_KEY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByText("Connected. 1 model available.")).toBeInTheDocument();
    expect(testProviderConnection).toHaveBeenCalledWith({
      kind: "openai-compatible",
      baseUrl: "http://127.0.0.1:4180/v1",
      secretEnvironmentVariable: "FUTURE_TEST_KEY",
    });
    expect(createWorkspace).not.toHaveBeenCalled();
    expect(createProvider).not.toHaveBeenCalled();
    expect(createModelProfile).not.toHaveBeenCalled();
  });

  it("does not persist external setup when the connection test fails", async () => {
    const testProviderConnection = vi.fn(async () => ({
      status: "missing_key" as const,
      message: "Set the configured environment variable and restart Singularity.",
    }));
    const createWorkspace = vi.fn();
    const createProvider = vi.fn();
    const createModelProfile = vi.fn();
    const api = { testProviderConnection, createWorkspace, createProvider, createModelProfile } as unknown as FutureApi;

    render(<FirstRunSetup api={api} workspaces={[]} providers={[]} modelProfiles={[]} onComplete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai-compatible" } });
    fireEvent.click(screen.getByRole("button", { name: "Create local assistant" }));

    expect(await screen.findByText("Set the configured environment variable and restart Singularity.")).toBeVisible();
    expect(createWorkspace).not.toHaveBeenCalled();
    expect(createProvider).not.toHaveBeenCalled();
    expect(createModelProfile).not.toHaveBeenCalled();
  });

  it("retests changed external connection details before persisting", async () => {
    const testProviderConnection = vi.fn(async () => ({ status: "ok" as const, models: ["model-a", "model-b"] }));
    const createWorkspace = vi.fn(async () => ({ id: "w_1" }));
    const createProvider = vi.fn(async () => ({ id: "provider_external" }));
    const createModelProfile = vi.fn(async () => ({ id: "profile_external" }));
    const api = { testProviderConnection, createWorkspace, createProvider, createModelProfile } as unknown as FutureApi;

    render(<FirstRunSetup api={api} workspaces={[]} providers={[]} modelProfiles={[]} onComplete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai-compatible" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByText("Connected. 2 models available.")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Base URL"), { target: { value: "https://second.example/v1" } });
    expect(screen.queryByText("Connected. 2 models available.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create local assistant" }));

    await waitFor(() => expect(createProvider).toHaveBeenCalledTimes(1));
    expect(testProviderConnection).toHaveBeenCalledTimes(2);
    expect(testProviderConnection).toHaveBeenLastCalledWith(
      expect.objectContaining({ baseUrl: "https://second.example/v1" }),
    );
  });
});
