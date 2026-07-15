import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FutureApi } from "./api-types";
import { App } from "./App";

afterEach(cleanup);

function createApi(overrides: Partial<FutureApi> = {}): FutureApi {
  return {
    listWorkspaces: vi.fn(async () => ({ workspaces: [] })),
    createWorkspace: vi.fn(),
    listProviders: vi.fn(async () => ({ providers: [] })),
    createProvider: vi.fn(),
    testProviderConnection: vi.fn(async () => ({ status: "ok" as const, models: [] })),
    listModelProfiles: vi.fn(async () => ({ modelProfiles: [] })),
    createModelProfile: vi.fn(),
    createAssistantTurn: vi.fn(),
    streamAssistantTurn: vi.fn(),
    cancelAssistantTurn: vi.fn(),
    listTimeline: vi.fn(async () => ({ events: [] })),
    getContextPack: vi.fn(),
    listMemories: vi.fn(async () => ({ items: [] })),
    getMemory: vi.fn(),
    listMemoryRevisions: vi.fn(async () => ({ revisions: [] })),
    createMemory: vi.fn(),
    updateMemory: vi.fn(),
    deleteMemory: vi.fn(),
    listNamespaces: vi.fn(async () => ({ namespaces: [] })),
    createNamespace: vi.fn(),
    createCompaction: vi.fn(),
    uploadImports: vi.fn(async () => ({ files: [] })),
    listImports: vi.fn(async () => ({ jobs: [] })),
    getImport: vi.fn(),
    retryImport: vi.fn(),
    getPromptPreview: vi.fn(),
    decidePromptPreview: vi.fn(),
    getSettings: vi.fn(async () => ({ redactLocalToo: false, autoCapture: true })),
    updateSettings: vi.fn(async () => ({ redactLocalToo: false, autoCapture: true })),
    setSecret: vi.fn(async () => ({ names: [] })),
    ...overrides,
  };
}

function createReadyApi(overrides: Partial<FutureApi> = {}): FutureApi {
  return createApi({
    listWorkspaces: vi.fn(async () => ({
      workspaces: [
        {
          id: "w_live",
          name: "Live Workspace",
          kind: "project",
          privacyMode: "standard" as const,
          createdAt: "2026-07-10T00:00:00.000Z",
          updatedAt: "2026-07-10T00:00:00.000Z",
        },
      ],
    })),
    listProviders: vi.fn(async () => ({
      providers: [
        {
          id: "prov_live",
          kind: "mock" as const,
          displayName: "Offline Mock",
          isLocal: true,
          hasSecret: false,
          capabilities: { streaming: true, text: true, embeddings: false },
          createdAt: "2026-07-10T00:00:00.000Z",
          updatedAt: "2026-07-10T00:00:00.000Z",
        },
      ],
    })),
    listModelProfiles: vi.fn(async () => ({
      modelProfiles: [
        {
          id: "profile_live",
          providerId: "prov_live",
          name: "Offline Default",
          model: "mock",
          contextWindow: 4096,
          purpose: "general",
          privacyPolicy: "local_only" as const,
          createdAt: "2026-07-10T00:00:00.000Z",
          updatedAt: "2026-07-10T00:00:00.000Z",
        },
      ],
    })),
    ...overrides,
  });
}

describe("App", () => {
  it("shows first-run setup when required local resources are missing", async () => {
    render(<App api={createApi()} />);

    expect(await screen.findByRole("heading", { name: "Set up Singularity" })).toBeInTheDocument();
    expect(screen.queryByText("Singularity Demo")).not.toBeInTheDocument();
  });

  it("renders live workspace and model data when setup is complete", async () => {
    render(<App api={createReadyApi()} />);

    expect(
      await screen.findByText((content, element) => {
        return element?.tagName === "SPAN" && content.startsWith("Model:");
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Message Singularity")).toBeInTheDocument();
  });

  it("shows a single chat and no lens navigation", async () => {
    render(<App api={createReadyApi()} />);

    expect(await screen.findByLabelText("Message Singularity")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Memory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Imports" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });

  it("opens the settings drawer from the gear", async () => {
    render(<App api={createReadyApi()} />);

    expect(await screen.findByLabelText("Message Singularity")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(screen.getByRole("dialog", { name: /settings/i })).toBeInTheDocument();
  });

  it("does not render a workspace switcher on the primary surface", async () => {
    render(<App api={createReadyApi()} />);

    expect(await screen.findByLabelText("Message Singularity")).toBeInTheDocument();
    expect(screen.queryByLabelText("Workspace")).not.toBeInTheDocument();
  });
});
