import { expect, test } from "@playwright/test";

// Regression guard for the chat-first shell layout.
//
// The "collapse to a single implicit workspace" refactor removed the left rail,
// but `.app-shell` still declared a two-column grid (`240px minmax(0, 1fr)`).
// With only the workspace child left, it was crammed into the 240px column,
// which collapsed `.content-grid`'s main column to 0px and hid the timeline and
// composer entirely. This test fails if the primary column ever collapses again.
test("chat shell renders a full-width main column", async ({ page }) => {
  await page.goto("/");

  // The e2e run shares one in-memory API, so setup may already be complete from
  // an earlier spec. Complete first-run setup with the offline mock only if the
  // setup screen is showing.
  await expect(page.getByLabel("Workspace name").or(page.getByLabel("Message Singularity"))).toBeVisible();
  if (await page.getByLabel("Workspace name").isVisible()) {
    await page.getByRole("button", { name: "Create local assistant" }).click();
  }

  const composer = page.getByLabel("Message Singularity");
  await expect(composer).toBeVisible();

  const mainColumn = page.locator(".main-column");
  const box = await mainColumn.boundingBox();
  expect(box).not.toBeNull();
  // A collapsed column measured ~0px; a healthy shell is several hundred px wide.
  expect(box!.width).toBeGreaterThan(400);

  const composerBox = await composer.boundingBox();
  expect(composerBox!.width).toBeGreaterThan(400);
});
