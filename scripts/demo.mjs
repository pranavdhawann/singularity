import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DEFAULT_API_BASE = "http://127.0.0.1:4174/api/v2";
const DEFAULT_WEB_ORIGIN = "http://127.0.0.1:4173";

export async function seedDemo({
  request = fetch,
  readSource = () => readFile(new URL("../examples/future-demo.md", import.meta.url)),
  apiBase = DEFAULT_API_BASE,
  webOrigin = DEFAULT_WEB_ORIGIN,
} = {}) {
  const session = await requestJson(request, `${apiBase}/session`);
  const existing = await requestJson(request, `${apiBase}/workspaces`);
  if (existing.workspaces.length > 0) {
    return { seeded: false, workspaceId: existing.workspaces[0].id };
  }

  const headers = {
    "content-type": "application/json",
    origin: webOrigin,
    "x-future-session": session.token,
  };
  const workspace = await requestJson(request, `${apiBase}/workspaces`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Future Demo", privacyMode: "standard" }),
  });
  const provider = await requestJson(request, `${apiBase}/providers`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "mock", displayName: "Offline Demo", isLocal: true }),
  });
  await requestJson(request, `${apiBase}/model-profiles`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      providerId: provider.id,
      name: "Offline Demo",
      model: "mock",
      contextWindow: 4096,
      purpose: "general",
      privacyPolicy: "local_only",
    }),
  });

  const source = await readSource();
  const form = new FormData();
  form.append("workspaceId", workspace.id);
  form.append("files", new File([source], "future-demo.md", { type: "text/markdown" }));
  const imported = await requestJson(request, `${apiBase}/imports`, {
    method: "POST",
    headers: { origin: webOrigin, "x-future-session": session.token },
    body: form,
  });

  return {
    seeded: true,
    workspaceId: workspace.id,
    importJobId: imported.files[0].job.id,
  };
}

async function requestJson(request, url, init) {
  const response = await request(url, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Demo request failed with HTTP ${response.status}`);
  }
  return body;
}

async function waitForApi(request = fetch, apiBase = DEFAULT_API_BASE) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await request(`${apiBase}/health`);
      if (response.ok) return;
    } catch {
      // The local API is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Future API did not become ready within 30 seconds");
}

async function run() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const child = spawn("corepack", ["pnpm", "dev"], {
    cwd: root,
    env: {
      ...process.env,
      FUTURE_DB_PATH: path.join(root, ".future", "demo.sqlite"),
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  const stop = () => child.kill();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await waitForApi();
    const result = await seedDemo();
    console.log(
      result.seeded
        ? `\nFuture demo seeded. Open ${DEFAULT_WEB_ORIGIN}\n`
        : `\nFuture demo already exists. Open ${DEFAULT_WEB_ORIGIN}\n`,
    );
  } catch (error) {
    child.kill();
    throw error;
  }

  child.once("exit", (code) => {
    process.exitCode = code ?? 0;
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await run();
}
