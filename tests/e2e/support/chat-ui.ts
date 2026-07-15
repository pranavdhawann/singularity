import { expect, type Page } from "@playwright/test";

// Navigation helpers for the chat-first shell. Providers, Memory, Imports, and
// Privacy live behind the top-bar settings gear as tabs in a focus-trapped
// drawer, rather than as top-level buttons. These helpers keep the acceptance
// specs readable as that UI shape evolves.

/** Opens the settings drawer (if closed) and activates the named tab. */
export async function openSettingsTab(page: Page, tab: "Providers" | "Memory" | "Imports" | "Privacy"): Promise<void> {
  const closeButton = page.getByRole("button", { name: "Close settings" });
  if (!(await closeButton.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Open settings" }).click();
  }
  await page.getByRole("tab", { name: tab, exact: true }).click();
  await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
}

/** Closes the settings drawer, returning focus to the timeline and composer. */
export async function closeSettings(page: Page): Promise<void> {
  const closeButton = page.getByRole("button", { name: "Close settings" });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
  await expect(page.getByLabel("Message Singularity")).toBeVisible();
}
