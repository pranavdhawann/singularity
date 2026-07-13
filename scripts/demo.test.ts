import { describe, expect, it, vi } from "vitest";
import { seedDemo } from "./demo.mjs";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("seedDemo", () => {
  it("creates an offline workspace and imports the bundled source through protected routes", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const request = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/session")) return jsonResponse({ token: "local-token" });
      if (url.endsWith("/workspaces") && !init?.method) return jsonResponse({ workspaces: [] });
      if (url.endsWith("/workspaces")) return jsonResponse({ id: "w_demo" }, 201);
      if (url.endsWith("/providers")) return jsonResponse({ id: "provider_demo" }, 201);
      if (url.endsWith("/model-profiles")) return jsonResponse({ id: "profile_demo" }, 201);
      if (url.endsWith("/imports")) {
        return jsonResponse({ files: [{ job: { id: "import_demo", state: "queued" } }] }, 201);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const result = await seedDemo({
      request,
      readSource: async () => Buffer.from("# Singularity demo\n\nCitations keep local context inspectable."),
      apiBase: "http://127.0.0.1:4174/api/v2",
      webOrigin: "http://127.0.0.1:4173",
    });

    expect(result).toEqual({ seeded: true, workspaceId: "w_demo", importJobId: "import_demo" });
    expect(calls.map((call) => call.url)).toEqual([
      "http://127.0.0.1:4174/api/v2/session",
      "http://127.0.0.1:4174/api/v2/workspaces",
      "http://127.0.0.1:4174/api/v2/workspaces",
      "http://127.0.0.1:4174/api/v2/providers",
      "http://127.0.0.1:4174/api/v2/model-profiles",
      "http://127.0.0.1:4174/api/v2/imports",
    ]);
    for (const call of calls.slice(2)) {
      expect(new Headers(call.init?.headers).get("x-future-session")).toBe("local-token");
      expect(new Headers(call.init?.headers).get("origin")).toBe("http://127.0.0.1:4173");
    }
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({ name: "Singularity Demo", privacyMode: "standard" });
    const upload = calls.at(-1)?.init?.body;
    expect(upload).toBeInstanceOf(FormData);
    expect((upload as FormData).get("workspaceId")).toBe("w_demo");
    expect((upload as FormData).get("files")).toEqual(expect.objectContaining({ name: "singularity-demo.md" }));
  });

  it("leaves an existing demo database unchanged", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: "local-token" }))
      .mockResolvedValueOnce(jsonResponse({ workspaces: [{ id: "w_existing" }] }));

    await expect(
      seedDemo({
        request,
        readSource: async () => {
          throw new Error("source should not be read");
        },
        apiBase: "http://127.0.0.1:4174/api/v2",
        webOrigin: "http://127.0.0.1:4173",
      }),
    ).resolves.toEqual({ seeded: false, workspaceId: "w_existing" });
    expect(request).toHaveBeenCalledTimes(2);
  });
});
