import { describe, expect, it, vi } from "vitest";
import {
  checkPrerequisites,
  createDevLaunch,
  getDemoDatabasePath,
  parseDemoArgs,
  resetDemoDatabase,
  seedDemo,
  stopProcessTree,
} from "./demo.mjs";

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

describe("demo launcher", () => {
  it("constructs a shell-free Windows Corepack launch", () => {
    const launch = createDevLaunch({
      platform: "win32",
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      pathExists: (candidate) => candidate.endsWith("node_modules\\corepack\\dist\\corepack.js"),
    });

    expect(launch).toEqual({
      command: "C:\\Program Files\\nodejs\\node.exe",
      args: ["C:\\Program Files\\nodejs\\node_modules\\corepack\\dist\\corepack.js", "pnpm", "dev"],
    });
  });

  it("terminates the complete Windows child process tree", () => {
    const killTree = vi.fn(() => ({ status: 0 }));
    const child = { pid: 4312, kill: vi.fn() };

    stopProcessTree(child, { platform: "win32", killTree });

    expect(killTree).toHaveBeenCalledWith("taskkill", ["/pid", "4312", "/t", "/f"], {
      shell: false,
      stdio: "ignore",
    });
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("rejects Node versions below 22 with remediation", () => {
    expect(() => checkPrerequisites({ nodeVersion: "20.19.0" })).toThrow(
      "Singularity requires Node.js 22 or newer. Install Node.js 22 or 24 and retry.",
    );
  });

  it("accepts Node 22", () => {
    expect(() => checkPrerequisites({ nodeVersion: "22.18.0", spawnCheck: () => ({ status: 0 }) })).not.toThrow(
      "Singularity requires Node.js 22 or newer. Install Node.js 22 or 24 and retry.",
    );
  });

  it("rejects unavailable Corepack with remediation", () => {
    expect(() =>
      checkPrerequisites({
        nodeVersion: "24.4.0",
        platform: "win32",
        execPath: "C:\\Program Files\\nodejs\\node.exe",
        pathExists: () => false,
      }),
    ).toThrow("Corepack is unavailable. Install or enable Corepack, then retry with `corepack pnpm demo`.");
  });

  it("parses reset and non-reset invocations explicitly", () => {
    expect(parseDemoArgs([])).toEqual({ reset: false });
    expect(parseDemoArgs(["--reset"])).toEqual({ reset: true });
  });

  it("removes only the demo database and its SQLite sidecars on reset", async () => {
    const removed: string[] = [];
    const root = "C:\\repo";

    await resetDemoDatabase({
      root,
      pathExists: () => true,
      resolveRealPath: async (candidate) => candidate,
      removeFile: async (candidate) => {
        removed.push(candidate);
      },
    });

    expect(removed).toEqual([
      "C:\\repo\\.future\\demo.sqlite",
      "C:\\repo\\.future\\demo.sqlite-wal",
      "C:\\repo\\.future\\demo.sqlite-shm",
      "C:\\repo\\.future\\demo.sqlite-journal",
    ]);
    expect(getDemoDatabasePath(root)).toBe("C:\\repo\\.future\\demo.sqlite");
  });

  it("refuses reset through a .future junction outside the repository", async () => {
    const removeFile = vi.fn();

    await expect(
      resetDemoDatabase({
        root: "C:\\repo",
        pathExists: () => true,
        resolveRealPath: async (candidate) => (candidate.endsWith(".future") ? "D:\\shared-data" : "C:\\repo"),
        removeFile,
      }),
    ).rejects.toThrow("Refusing to reset a demo database through .future outside C:\\repo");
    expect(removeFile).not.toHaveBeenCalled();
  });

  it("refuses a demo database target outside .future", () => {
    expect(() => getDemoDatabasePath("C:\\repo", "..\\future.sqlite")).toThrow(
      "Refusing to use a demo database outside C:\\repo\\.future",
    );
  });
});
