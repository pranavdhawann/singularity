import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSettingsPanels } from "./SettingsPanels";
import type { FutureApi } from "../../app/api-types";

afterEach(cleanup);

describe("buildSettingsPanels", () => {
  it("returns Providers, Memory, Imports, and Privacy panels", () => {
    const api = {
      listImports: vi.fn(async () => ({ jobs: [] })),
      listProviders: vi.fn(async () => ({ providers: [] })),
      listMemories: vi.fn(async () => ({ items: [] })),
      listNamespaces: vi.fn(async () => ({ namespaces: [] })),
      getSettings: vi.fn(async () => ({ redactLocalToo: false, autoCapture: true })),
    } as unknown as FutureApi;
    const panels = buildSettingsPanels({ api, workspaceId: "w_1" });
    expect(Object.keys(panels)).toEqual(["Providers", "Memory", "Imports", "Privacy"]);
    render(<>{panels.Imports}</>);
    expect(screen.getByLabelText("Imports workspace")).toBeInTheDocument();
  });
});
