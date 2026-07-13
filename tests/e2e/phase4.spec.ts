import { expect, test } from "@playwright/test";
import path from "node:path";

test("browser imports, resumes indexing, approves an exact external prompt, and inspects citations", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await expect(page.getByLabel("Workspace name").or(page.getByLabel("Message Future"))).toBeVisible();
  if (await page.getByLabel("Workspace name").isVisible()) {
    await page.getByLabel("Workspace name").fill("Phase 4 Workspace");
    await page.getByRole("button", { name: "Create local assistant" }).click();
  }
  await expect(page.getByLabel("Message Future")).toBeVisible();

  const session = await page.request.get("/api/v2/session");
  const token = ((await session.json()) as { token: string }).token;
  const headers = { "x-future-session": token };
  const workspaces = await page.request.get("/api/v2/workspaces");
  const workspaceId = ((await workspaces.json()) as { workspaces: Array<{ id: string }> }).workspaces[0]!.id;
  const providerResponse = await page.request.post("/api/v2/providers", {
    headers,
    data: {
      kind: "openai-compatible",
      displayName: "Phase 4 External",
      baseUrl: "http://127.0.0.1:4280/v1",
      secretEnvironmentVariable: "FUTURE_TEST_OPENAI_KEY",
      isLocal: false,
    },
  });
  expect(providerResponse.ok()).toBeTruthy();
  const providerId = ((await providerResponse.json()) as { id: string }).id;
  const profileResponse = await page.request.post("/api/v2/model-profiles", {
    headers,
    data: {
      providerId,
      name: "Phase 4 External",
      model: "phase4-model",
      contextWindow: 8192,
      purpose: "general",
      privacyPolicy: "prompt_preview",
    },
  });
  expect(profileResponse.ok()).toBeTruthy();

  await page.reload();
  await page.getByLabel("Model profile").selectOption({ label: "Phase 4 External" });
  await page.getByRole("button", { name: "Imports", exact: true }).click();
  await page
    .getByLabel("Choose import files")
    .setInputFiles([
      path.resolve("tests/fixtures/imports/phase4-notes.md"),
      path.resolve("tests/fixtures/imports/chatgpt-export.json"),
    ]);
  await page.getByRole("button", { name: "Import selected files" }).click();

  for (const filename of ["phase4-notes.md", "chatgpt-export.json"]) {
    const card = page.locator("article").filter({ hasText: filename });
    await expect(card.getByText("failed", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: `Retry ${filename}` }).click();
    await expect(card.getByText("completed", { exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  const composer = page.getByLabel("Message Future");
  await composer.fill("resumable import decision");
  await page.getByRole("button", { name: "Send" }).click();

  const preview = page.getByRole("dialog", { name: "External prompt preview" });
  await expect(preview).toBeVisible();
  await expect(preview.getByText("external", { exact: true })).toBeVisible();
  await expect(preview.getByText("phase4-model", { exact: true })).toBeVisible();
  await expect(preview.getByText(/email: 1/)).toBeVisible();
  await expect(preview.getByText("[REDACTED_EMAIL]", { exact: false })).toBeVisible();
  const selectedSource = preview.getByRole("listitem").filter({ hasText: "phase4-notes.md" }).first();
  await expect(selectedSource).toBeVisible();
  await expect(selectedSource).toContainText(/characters \d+-\d+/);
  await preview.getByRole("button", { name: "Approve exact prompt" }).click();

  await expect(page.getByText("Phase 4 external answer", { exact: true })).toBeVisible();
  const citation = page.getByRole("button", { name: /Citation 1:/ }).last();
  await expect(citation).toBeVisible();
  await citation.click();
  await expect(page.getByText("Model: phase4-model")).toBeVisible();
  await expect(page.getByText(/Characters \d+-\d+/).first()).toBeVisible();

  const timeline = await page.request.get(`/api/v2/timeline?workspaceId=${workspaceId}`);
  const events = ((await timeline.json()) as { events: Array<{ type: string; payload: Record<string, unknown> }> })
    .events;
  const required = events.find((event) => event.type === "prompt_preview.required");
  const approved = events.find((event) => event.type === "prompt_preview.approved");
  expect(required?.payload).toEqual(
    expect.objectContaining({ previewId: expect.any(String), bindingHash: expect.any(String) }),
  );
  expect(approved?.payload).toEqual(expect.objectContaining({ decisionId: expect.any(String) }));
  const storedPreview = await page.request.get(
    `/api/v2/prompt-previews/${String(required?.payload.previewId)}?workspaceId=${workspaceId}`,
  );
  expect(((await storedPreview.json()) as { redactedPrompt: string }).redactedPrompt).not.toContain(
    "phase4-owner@example.com",
  );
});
