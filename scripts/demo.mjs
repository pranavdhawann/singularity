import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, realpath, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DEFAULT_API_BASE = "http://127.0.0.1:4174/api/v2";
const DEFAULT_WEB_ORIGIN = "http://127.0.0.1:4173";

export function parseDemoArgs(args) {
  const unknown = args.filter((argument) => argument !== "--reset");
  if (unknown.length > 0) {
    throw new Error(`Unknown demo option: ${unknown[0]}`);
  }
  return { reset: args.includes("--reset") };
}

function platformPath(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

function corepackInvocation({
  platform = process.platform,
  execPath = process.execPath,
  pathExists = existsSync,
} = {}) {
  if (platform !== "win32") {
    return { command: "corepack", args: [] };
  }

  const pathApi = platformPath(platform);
  const corepackCli = pathApi.join(pathApi.dirname(execPath), "node_modules", "corepack", "dist", "corepack.js");
  if (!pathExists(corepackCli)) {
    throw new Error("Corepack is unavailable. Install or enable Corepack, then retry with `corepack pnpm demo`.");
  }
  return { command: execPath, args: [corepackCli] };
}

export function createDevLaunch(options = {}) {
  const corepack = corepackInvocation(options);
  return { command: corepack.command, args: [...corepack.args, "pnpm", "dev"] };
}

export function checkPrerequisites({
  nodeVersion = process.versions.node,
  spawnCheck = spawnSync,
  ...launchOptions
} = {}) {
  const [majorVersion, minorVersion] = nodeVersion.split(".");
  const nodeMajor = Number.parseInt(majorVersion ?? "", 10);
  const nodeMinor = Number.parseInt(minorVersion ?? "", 10);
  if (
    !Number.isInteger(nodeMajor) ||
    !Number.isInteger(nodeMinor) ||
    nodeMajor < 22 ||
    (nodeMajor === 22 && nodeMinor < 13)
  ) {
    throw new Error("Singularity requires Node.js 22.13 or newer. Install Node.js 22 or 24 and retry.");
  }

  const corepack = corepackInvocation(launchOptions);
  const result = spawnCheck(corepack.command, [...corepack.args, "--version"], {
    shell: false,
    stdio: "ignore",
  });
  if (result.error || result.status !== 0) {
    throw new Error("Corepack is unavailable. Install or enable Corepack, then retry with `corepack pnpm demo`.");
  }
  return corepack;
}

function pathForRoot(root) {
  return /^[A-Za-z]:[\\/]/.test(root) ? path.win32 : path;
}

export function getDemoDatabasePath(root, databaseName = "demo.sqlite") {
  const pathApi = pathForRoot(root);
  const dataDirectory = pathApi.resolve(root, ".future");
  const databasePath = pathApi.resolve(dataDirectory, databaseName);
  const relative = pathApi.relative(dataDirectory, databasePath);
  if (!relative || relative.startsWith(`..${pathApi.sep}`) || relative === ".." || pathApi.isAbsolute(relative)) {
    throw new Error(`Refusing to use a demo database outside ${dataDirectory}`);
  }
  return databasePath;
}

export async function resetDemoDatabase({
  root,
  pathExists = existsSync,
  resolveRealPath = realpath,
  removeFile = rm,
} = {}) {
  const databasePath = getDemoDatabasePath(root);
  const pathApi = pathForRoot(root);
  const dataDirectory = pathApi.dirname(databasePath);
  if (!pathExists(dataDirectory)) return;

  const [realRoot, realDataDirectory] = await Promise.all([
    resolveRealPath(pathApi.resolve(root)),
    resolveRealPath(dataDirectory),
  ]);
  const relativeDataDirectory = pathApi.relative(realRoot, realDataDirectory);
  if (
    !relativeDataDirectory ||
    relativeDataDirectory.startsWith(`..${pathApi.sep}`) ||
    relativeDataDirectory === ".." ||
    pathApi.isAbsolute(relativeDataDirectory)
  ) {
    throw new Error(`Refusing to reset a demo database through .future outside ${pathApi.resolve(root)}`);
  }

  for (const candidate of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`, `${databasePath}-journal`]) {
    await removeFile(candidate, { force: true });
  }
}

export function stopProcessTree(child, { platform = process.platform, killTree = spawnSync } = {}) {
  if (!child.pid) return;
  if (platform === "win32") {
    killTree("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      shell: false,
      stdio: "ignore",
    });
    return;
  }
  child.kill("SIGTERM");
}

export async function seedDemo({
  request = fetch,
  readSource = () => readFile(new URL("../examples/singularity-demo.md", import.meta.url)),
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
    body: JSON.stringify({ name: "Singularity Demo", privacyMode: "standard" }),
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
  form.append("files", new File([source], "singularity-demo.md", { type: "text/markdown" }));
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
  throw new Error("Singularity API did not become ready within 30 seconds");
}

export async function runDemo({ args = process.argv.slice(2) } = {}) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const options = parseDemoArgs(args);
  checkPrerequisites();
  if (options.reset) {
    await resetDemoDatabase({ root });
  }

  const launch = createDevLaunch();
  const child = spawn(launch.command, launch.args, {
    cwd: root,
    env: {
      ...process.env,
      FUTURE_DB_PATH: getDemoDatabasePath(root),
    },
    shell: false,
    stdio: "inherit",
  });

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    stopProcessTree(child);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await waitForApi();
    const result = await seedDemo();
    console.log(
      result.seeded
        ? `\nSingularity demo seeded. Open ${DEFAULT_WEB_ORIGIN}\n`
        : `\nSingularity demo already exists. Open ${DEFAULT_WEB_ORIGIN}\n`,
    );
  } catch (error) {
    stop();
    throw error;
  }

  child.once("exit", (code) => {
    process.exitCode = code ?? 0;
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await runDemo();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
