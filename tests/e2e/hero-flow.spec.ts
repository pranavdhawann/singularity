import { expect, test } from "@playwright/test";

test("browser drives the persistent cited assistant flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Set up Future" })).toBeVisible();
  await page.getByLabel("Workspace name").fill("Browser Workspace");
  await page.getByRole("button", { name: "Create local assistant" }).click();

  await expect(page.getByLabel("Workspace")).toContainText("Browser Workspace");
  await expect(page.getByText("Model: Default")).toBeVisible();
  await expect(page.getByRole("button", { name: /command palette/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();

  const composer = page.getByLabel("Message Future");
  await composer.fill("Remember this first browser question");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Mock response for: Remember this first browser question/)).toBeVisible();

  await composer.fill("What did I just ask?");
  await page.getByRole("button", { name: "Send" }).click();
  const citation = page.getByRole("button", { name: /Citation 1:/ }).last();
  await expect(citation).toBeVisible();
  await citation.click();
  await expect(page.getByText("Model: mock")).toBeVisible();
  await expect(page.getByText("Timeline event").first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("Remember this first browser question", { exact: true })).toBeVisible();
  await expect(page.getByText("What did I just ask?", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Message Future")).toBeVisible();
});

test("memory retrieval lifecycle changes source-backed answers", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.getByLabel("Workspace name").or(page.getByLabel("Message Future"))).toBeVisible();
  if (await page.getByLabel("Workspace name").isVisible()) {
    await page.getByLabel("Workspace name").fill("Memory Workspace");
    await page.getByRole("button", { name: "Create local assistant" }).click();
  }
  await expect(page.getByLabel("Message Future")).toBeVisible();

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
  const composer = page.getByLabel("Message Future");
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
  await expect(page.getByLabel("Message Future")).toBeVisible();
});
