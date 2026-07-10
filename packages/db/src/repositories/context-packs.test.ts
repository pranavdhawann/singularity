import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../test-db";
import { ContextPackRepository } from "./context-packs";

describe("ContextPackRepository", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("persists an immutable inspectable context pack", () => {
    const packs = new ContextPackRepository(db.client);
    const pack = {
      id: "ctx_1",
      workspaceId: "w_demo",
      turnId: "turn_1",
      modelProfileId: "profile_1",
      providerId: "provider_1",
      model: "mock",
      items: [
        {
          source: {
            kind: "memory" as const,
            id: "mem_1",
            workspaceId: "w_demo",
            title: "Database decision",
            contentHash: "abc"
          },
          text: "Use SQLite.",
          tokenCount: 3,
          score: 12
        }
      ],
      estimatedTokens: 8,
      redactionCount: 0,
      createdAt: "2026-07-10T12:00:00.000Z"
    };

    packs.create(pack);

    expect(packs.get(pack.id)).toEqual(pack);
    expect(() => packs.create(pack)).toThrow();
  });
});
