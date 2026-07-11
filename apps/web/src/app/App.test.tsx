import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FutureApi } from "./api-types";
import { App } from "./App";

function createApi(overrides: Partial<FutureApi> = {}): FutureApi {
  return {
    listWorkspaces: vi.fn(async () => ({ workspaces: [] })),
    createWorkspace: vi.fn(),
    listProviders: vi.fn(async () => ({ providers: [] })),
    createProvider: vi.fn(),
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
    ...overrides
  };
}

describe("App", () => {
  it("shows first-run setup when required local resources are missing", async () => {
    render(<App api={createApi()} />);

    expect(await screen.findByRole("heading", { name: "Set up Future" })).toBeInTheDocument();
    expect(screen.queryByText("Future Demo")).not.toBeInTheDocument();
  });

  it("renders live workspace and model data when setup is complete", async () => {
    const api = createApi({
      listWorkspaces: vi.fn(async () => ({
        workspaces: [{
          id: "w_live",
          name: "Live Workspace",
          kind: "project",
          privacyMode: "standard" as const,
          createdAt: "2026-07-10T00:00:00.000Z",
          updatedAt: "2026-07-10T00:00:00.000Z"
        }]
      })),
      listProviders: vi.fn(async () => ({
        providers: [{
          id: "prov_live",
          kind: "mock" as const,
          displayName: "Offline Mock",
          isLocal: true,
          hasSecret: false,
          capabilities: { streaming: true, text: true, embeddings: false },
          createdAt: "2026-07-10T00:00:00.000Z",
          updatedAt: "2026-07-10T00:00:00.000Z"
        }]
      })),
      listModelProfiles: vi.fn(async () => ({
        modelProfiles: [{
          id: "profile_live",
          providerId: "prov_live",
          name: "Offline Default",
          model: "mock",
          contextWindow: 4096,
          purpose: "general",
          privacyPolicy: "local_only" as const,
          createdAt: "2026-07-10T00:00:00.000Z",
          updatedAt: "2026-07-10T00:00:00.000Z"
        }]
      }))
    });

    render(<App api={api} />);

    expect(await screen.findByText("Live Workspace")).toBeInTheDocument();
    expect(screen.getByText("Model: Offline Default")).toBeInTheDocument();
    expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Message Future")).toBeInTheDocument();
  });
});
