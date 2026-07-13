import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findBrokenMarkdownLinks } from "./check-markdown-links.mjs";

const temporaryRoots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "singularity-links-"));
  temporaryRoots.push(root);
  await mkdir(path.join(root, "docs"), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("findBrokenMarkdownLinks", () => {
  it("accepts repository-relative links while ignoring anchors and external URLs", async () => {
    const root = await createRoot();
    await writeFile(
      path.join(root, "README.md"),
      [
        "[Guide](docs/guide.md#setup)",
        "[Section](#quick-start)",
        "[Website](https://example.com/path)",
        "![Badge](https://img.shields.io/badge/test-pass-brightgreen)",
      ].join("\n"),
    );
    await writeFile(path.join(root, "docs", "guide.md"), "[Security](../SECURITY.md)\n");
    await writeFile(path.join(root, "SECURITY.md"), "# Security\n");

    await expect(findBrokenMarkdownLinks(root)).resolves.toEqual([]);
  });

  it("reports a missing local target with its source file", async () => {
    const root = await createRoot();
    await writeFile(path.join(root, "README.md"), "[Missing](docs/missing.md#details)\n");

    await expect(findBrokenMarkdownLinks(root)).resolves.toEqual([
      {
        source: "README.md",
        target: "docs/missing.md",
      },
    ]);
  });

  it("limits checks to root community files and docs", async () => {
    const root = await createRoot();
    await writeFile(path.join(root, "README.md"), "# Root\n");
    await mkdir(path.join(root, "packages", "example"), { recursive: true });
    await writeFile(path.join(root, "packages", "example", "README.md"), "[Ignored](missing.md)\n");

    await expect(findBrokenMarkdownLinks(root)).resolves.toEqual([]);
  });

  it("ignores Markdown examples inside fenced code blocks", async () => {
    const root = await createRoot();
    await writeFile(path.join(root, "README.md"), ["```markdown", "[Example](docs/not-created.md)", "```"].join("\n"));

    await expect(findBrokenMarkdownLinks(root)).resolves.toEqual([]);
  });

  it("checks local targets declared by reference-style links", async () => {
    const root = await createRoot();
    await writeFile(path.join(root, "README.md"), "[Guide][guide]\n\n[guide]: docs/missing-guide.md\n");

    await expect(findBrokenMarkdownLinks(root)).resolves.toEqual([
      { source: "README.md", target: "docs/missing-guide.md" },
    ]);
  });
});
