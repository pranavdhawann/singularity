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

  it("lists new events after a cursor in ascending order", () => {
    const repo = new EventRepository(db.client);
    for (const [id, minute] of [["evt_one", "00"], ["evt_two", "01"], ["evt_three", "02"]] as const) {
      repo.append({
        id,
        workspaceId: "w_demo",
        type: "user.message.created",
        actor: "user",
        title: id,
        payload: { text: id },
        privacy: { labels: ["local"] },
        createdAt: new Date(`2026-07-10T12:${minute}:00.000Z`)
      });
    }

    expect(
      repo.list({ workspaceId: "w_demo", after: "evt_one", order: "asc" }).map((event) => event.id)
    ).toEqual(["evt_two", "evt_three"]);
  });

  it("attaches and returns ordered normalized sources", () => {
    const repo = new EventRepository(db.client);
    repo.append({
      id: "evt_answer",
      workspaceId: "w_demo",
      type: "assistant.response.created",
      actor: "assistant",
      title: "Answer",
      payload: { responseText: "SQLite" },
      privacy: { labels: ["local"] },
      createdAt: new Date("2026-07-10T12:00:00.000Z")
    });
    const sources = [
      {
        kind: "memory" as const,
        id: "mem_1",
        workspaceId: "w_demo",
        title: "Decision",
        contentHash: "a"
      },
      {
        kind: "document_chunk" as const,
        id: "chunk_1",
        workspaceId: "w_demo",
        title: "Notes",
        contentHash: "b",
        range: { start: 0, end: 20 }
      }
    ];

    repo.attachSources("evt_answer", sources);

    expect(repo.listSources("evt_answer")).toEqual(sources);
  });
});
