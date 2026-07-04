import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../test-db";
import { EventRepository } from "./events";

describe("EventRepository", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("stores and lists timeline events newest first by default", () => {
    const repo = new EventRepository(db.client);

    repo.append({
      id: "evt_one",
      workspaceId: "w_demo",
      type: "workspace.created",
      actor: "user",
      title: "Created Demo",
      payload: { name: "Demo" },
      privacy: { labels: ["local"] },
      createdAt: new Date("2026-07-04T12:00:00.000Z")
    });

    repo.append({
      id: "evt_two",
      workspaceId: "w_demo",
      type: "command.started",
      actor: "user",
      title: "Asked With Memory",
      payload: { command: "ask_with_memory" },
      privacy: { labels: ["local"] },
      createdAt: new Date("2026-07-04T12:01:00.000Z")
    });

    const events = repo.list({ workspaceId: "w_demo" });
    expect(events.map((event) => event.id)).toEqual(["evt_two", "evt_one"]);
    expect(events[0]?.payload).toEqual({ command: "ask_with_memory" });
  });
});
