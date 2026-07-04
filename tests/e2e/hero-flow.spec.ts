import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const apiBaseUrl = "http://127.0.0.1:4174";

test("hero flow records imports, memory, context, model call, and response", async ({
  page,
  request
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /command palette/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();

  const suffix = Date.now().toString();
  const workspaceResponse = await request.post(`${apiBaseUrl}/api/workspaces`, {
    data: { name: `Hero Workspace ${suffix}` }
  });
  expect(workspaceResponse.ok()).toBe(true);
  const workspace = (await workspaceResponse.json()) as { id: string };

  const fixtureText = await readFile(resolve("tests/e2e/fixtures/hero.md"), "utf8");
  const importResponse = await request.post(`${apiBaseUrl}/api/imports`, {
    data: {
      workspaceId: workspace.id,
      kind: "markdown",
      title: "Hero Notes",
      sourceUri: "fixture://hero.md",
      text: fixtureText
    }
  });
  expect(importResponse.ok()).toBe(true);

  const memoryResponse = await request.post(`${apiBaseUrl}/api/memories`, {
    data: {
      workspaceId: workspace.id,
      type: "fact",
      statement: "Future uses SQLite as the local source of truth.",
      confidence: 0.95
    }
  });
  expect(memoryResponse.ok()).toBe(true);
  const memory = (await memoryResponse.json()) as { id: string };

  const promoteResponse = await request.post(`${apiBaseUrl}/api/memories/${memory.id}/promote`);
  expect(promoteResponse.ok()).toBe(true);

  const previewResponse = await request.post(`${apiBaseUrl}/api/context-packs/preview`, {
    data: {
      workspaceId: workspace.id,
      command: "What is Future's local storage choice?"
    }
  });
  expect(previewResponse.ok()).toBe(true);
  const preview = (await previewResponse.json()) as { items: Array<{ id: string }> };
  expect(preview.items.map((item) => item.id)).toContain(memory.id);

  const commandResponse = await request.post(`${apiBaseUrl}/api/commands`, {
    data: {
      workspaceId: workspace.id,
      command: "ask_with_memory",
      input: "What should we build first?",
      providerId: "mock"
    }
  });
  expect(commandResponse.ok()).toBe(true);

  const timelineResponse = await request.get(
    `${apiBaseUrl}/api/timeline?workspaceId=${workspace.id}&limit=50`
  );
  expect(timelineResponse.ok()).toBe(true);
  const timeline = (await timelineResponse.json()) as { events: Array<{ type: string }> };
  const eventTypes = timeline.events.map((event) => event.type);

  expect(eventTypes).toEqual(
    expect.arrayContaining([
      "import.started",
      "document.imported",
      "import.finished",
      "memory.approved",
      "context_pack.created",
      "model_call.completed",
      "assistant.response.created"
    ])
  );
});
