import { access, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MARKDOWN_LINK = /!?\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^)]*["'])?\s*\)/g;
const MARKDOWN_REFERENCE = /^\s{0,3}\[[^\]]+\]:\s*(<[^>\r\n]+>|[^\s\r\n]+)/gm;

async function collectMarkdownFiles(root) {
  const files = [];
  const rootEntries = await readdir(root, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(path.join(root, entry.name));
    }
  }

  const docsRoot = path.join(root, "docs");
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(candidate);
    }
  }
  await visit(docsRoot);
  return files.sort();
}

function localTarget(rawTarget) {
  const unwrapped = rawTarget.startsWith("<") && rawTarget.endsWith(">") ? rawTarget.slice(1, -1) : rawTarget;
  if (!unwrapped || unwrapped.startsWith("#") || unwrapped.startsWith("//")) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(unwrapped)) return null;
  const withoutFragment = unwrapped.split("#", 1)[0]?.split("?", 1)[0] ?? "";
  if (!withoutFragment) return null;
  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
}

function withoutFencedCode(markdown) {
  let fence = null;
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const marker = line.trimStart().match(/^(`{3,}|~{3,})/)?.[1];
      if (marker && !fence) {
        fence = { character: marker[0], length: marker.length };
        return "";
      }
      if (marker && fence && marker[0] === fence.character && marker.length >= fence.length) {
        fence = null;
        return "";
      }
      return fence ? "" : line;
    })
    .join("\n");
}

async function exists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function findBrokenMarkdownLinks(root) {
  const broken = [];
  for (const sourcePath of await collectMarkdownFiles(root)) {
    const markdown = withoutFencedCode(await readFile(sourcePath, "utf8"));
    const targets = [
      ...Array.from(markdown.matchAll(MARKDOWN_LINK), (match) => match[1] ?? ""),
      ...Array.from(markdown.matchAll(MARKDOWN_REFERENCE), (match) => match[1] ?? ""),
    ];
    for (const rawTarget of targets) {
      const target = localTarget(rawTarget);
      if (!target) continue;
      const resolved = target.startsWith("/")
        ? path.resolve(root, target.slice(1))
        : path.resolve(path.dirname(sourcePath), target);
      if (!(await exists(resolved))) {
        broken.push({
          source: path.relative(root, sourcePath).replaceAll(path.sep, "/"),
          target: target.replaceAll("\\", "/"),
        });
      }
    }
  }
  return broken;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const broken = await findBrokenMarkdownLinks(root);
  if (broken.length > 0) {
    for (const link of broken) console.error(`${link.source}: missing local target ${link.target}`);
    process.exitCode = 1;
  } else {
    console.log("Markdown links OK");
  }
}
