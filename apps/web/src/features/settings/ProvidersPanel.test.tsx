import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FutureApi } from "../../app/api-types";
import { ProvidersPanel } from "./ProvidersPanel";

afterEach(cleanup);

function buildApi(overrides: Partial<FutureApi> = {}): FutureApi {
  return {
    listProviders: vi.fn(async () => ({
      providers: [
        {
          id: "p_1",
          kind: "openai-compatible",
          displayName: "Local Ollama",
          isLocal: true,
          hasSecret: false,
          capabilities: { streaming: true, text: true, embeddings: false },
          createdAt: "t",
          updatedAt: "t",
        },
      ],
    })),
    setSecret: vi.fn(async () => ({ names: ["OPENAI_API_KEY"] })),
    ...overrides,
  } as unknown as FutureApi;
}

describe("ProvidersPanel", () => {
  it("renders configured providers and a secret entry form", async () => {
    const api = buildApi();
    render(<ProvidersPanel api={api} />);

    expect(await screen.findByText("Local Ollama")).toBeInTheDocument();
    expect(screen.getByLabelText(/secret name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/secret value/i)).toHaveAttribute("type", "password");
  });

  it("calls setSecret with the entered name and value on save", async () => {
    const api = buildApi();
    render(<ProvidersPanel api={api} />);

    await screen.findByText("Local Ollama");
    fireEvent.change(screen.getByLabelText(/secret name/i), { target: { value: "OPENAI_API_KEY" } });
    fireEvent.change(screen.getByLabelText(/secret value/i), { target: { value: "sk-test" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(api.setSecret).toHaveBeenCalledWith("OPENAI_API_KEY", "sk-test"));
  });
});
