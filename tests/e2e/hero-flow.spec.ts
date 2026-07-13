import { expect, test } from "@playwright/test";
import path from "node:path";

test("first run imports a local source and produces an inspectable cited answer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Set up Singularity" })).toBeVisible();
  await page.getByLabel("Workspace name").fill("Browser Workspace");
  await page.getByRole("combobox", { name: "Provider", exact: true }).selectOption("openai-compatible");
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4280/v1");
  await page.getByLabel("Secret environment variable").fill("FUTURE_TEST_OPENAI_KEY");
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText("Connected. 1 model available.")).toBeVisible();
  const providersBeforeSetup = await page.request.get("/api/v2/providers");
  expect(await providersBeforeSetup.json()).toEqual({ providers: [] });
  await page.getByRole("combobox", { name: "Provider", exact: true }).selectOption("mock");
  await page.getByRole("button", { name: "Create local assistant" }).click();

  await expect(page.getByLabel("Workspace")).toContainText("Browser Workspace");
  await expect(page.getByText("Model: Default")).toBeVisible();
  await expect(page.getByRole("button", { name: /command palette/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();

  await page.getByRole("button", { name: "Imports", exact: true }).click();
  await page.getByLabel("Choose import files").setInputFiles(path.resolve("examples/singularity-demo.md"));
  await page.getByRole("button", { name: "Import selected files" }).click();
  const imported = page.locator("article").filter({ hasText: "singularity-demo.md" });
  await expect(imported.getByText("failed", { exact: true })).toBeVisible();
  await imported.getByRole("button", { name: "Retry singularity-demo.md" }).click();
  await expect(imported.getByText("completed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Timeline", exact: true }).click();

  const composer = page.getByLabel("Message Singularity");
  await composer.fill("launch readiness decision");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Mock response for: launch readiness decision/)).toBeVisible();
  const importedCitation = page.getByRole("button", { name: /Citation \d+:.*singularity-demo\.md/ }).last();
  await expect(importedCitation).toBeVisible();
  await importedCitation.click();
  await expect(page.getByText("Document chunk").first()).toBeVisible();

  await composer.fill("What did I just ask about launch readiness?");
  await page.getByRole("button", { name: "Send" }).click();
  const citation = page.getByRole("button", { name: /Citation 1:/ }).last();
  await expect(citation).toBeVisible();
  await citation.click();
  await expect(page.getByText("Model: mock")).toBeVisible();
  await expect(page.getByText(/Document chunk|Timeline event/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("launch readiness decision", { exact: true })).toBeVisible();
  await expect(page.getByText("What did I just ask about launch readiness?", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Message Singularity")).toBeVisible();
});

test("memory retrieval lifecycle changes source-backed answers", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.getByLabel("Workspace name").or(page.getByLabel("Message Singularity"))).toBeVisible();
  if (await page.getByLabel("Workspace name").isVisible()) {
    await page.getByLabel("Workspace name").fill("Memory Workspace");
    await page.getByRole("button", { name: "Create local assistant" }).click();
  }
  await expect(page.getByLabel("Message Singularity")).toBeVisible();

  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await page.getByLabel("New namespace").fill("Architecture");
  await page.getByRole("button", { name: "Create namespace" }).click();
  await expect(page.getByRole("button", { name: "Architecture" })).toBeVisible();
  await page.getByLabel("New memory").fill("Project codename is Firefly");
  await page.getByRole("button", { name: "Add for review" }).click();
  await expect(page.getByLabel("Memory statement")).toHaveValue("Project codename is Firefly");
  await page.getByLabel("Memory status", { exact: true }).selectOption("approved");
  await page.getByLabel("Pinned").check();
  await page.getByLabel("Primary namespace").selectOption({ label: "Architecture" });
  await page.getByRole("button", { name: "Save memory" }).click();
  await expect(page.getByText("Version 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Revision history")).toBeVisible();

  await page.getByRole("button", { name: "Timeline" }).click();
  const composer = page.getByLabel("Message Singularity");
  await composer.fill("What is the project codename?");
  await page.getByRole("button", { name: "Send" }).click();
  const firstAnswer = page.getByLabel("Assistant response").last();
  await expect(firstAnswer.getByRole("button", { name: /Pinned memory|Approved memory/ })).toBeVisible();
  await firstAnswer.getByRole("button", { name: /Pinned memory|Approved memory/ }).click();
  await expect(page.getByText("Final score", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/Lexical retrieval only/)).toBeVisible();

  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await page.getByRole("button", { name: "Project codename is Firefly" }).click();
  await page.getByLabel("Memory status", { exact: true }).selectOption("outdated");
  await page.getByRole("button", { name: "Save memory" }).click();
  await page.getByRole("button", { name: "Timeline" }).click();
  await composer.fill("Repeat the project codename from memory");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(
    page
      .getByLabel("Assistant response")
      .last()
      .getByRole("button", { name: /Pinned memory|Approved memory/ }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await page.getByRole("button", { name: "Project codename is Firefly" }).click();
  await page.getByLabel("Memory statement").fill("Project codename is Dragonfly");
  await page.getByLabel("Memory status", { exact: true }).selectOption("approved");
  await page.getByRole("button", { name: "Save memory" }).click();
  await expect(page.getByRole("button", { name: "Project codename is Dragonfly" })).toBeVisible();
  await page.getByRole("button", { name: "Project codename is Dragonfly" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete memory" }).click();
  await expect(page.getByRole("button", { name: "Project codename is Dragonfly" })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await expect(page.getByRole("button", { name: "Project codename is Dragonfly" })).toHaveCount(0);
  await expect(page.getByLabel("Message Singularity")).toBeVisible();
});
