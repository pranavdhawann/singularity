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
