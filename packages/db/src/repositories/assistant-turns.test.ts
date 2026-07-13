import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../test-db";
import { AssistantTurnConflictError, AssistantTurnRepository } from "./assistant-turns";

describe("AssistantTurnRepository", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("creates one user event for an idempotent turn", () => {
    const turns = new AssistantTurnRepository(db.client);
    const input = {
      workspaceId: "w_demo",
      modelProfileId: "profile_1",
      idempotencyKey: "key_1",
      message: "Hello Future",
    };
    const first = turns.create(input);
    const replay = turns.create(input);

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ turn: first.turn, replayed: true });
    expect(db.client.prepare("SELECT COUNT(*) FROM events WHERE type = 'user.message.created'").pluck().get()).toBe(1);
  });

  it("rejects reuse of an idempotency key for different input", () => {
    const turns = new AssistantTurnRepository(db.client);
    turns.create({
      workspaceId: "w_demo",
      modelProfileId: "profile_1",
      idempotencyKey: "key_1",
      message: "First message",
    });

    expect(() =>
      turns.create({
        workspaceId: "w_demo",
        modelProfileId: "profile_1",
        idempotencyKey: "key_1",
        message: "Different message",
      }),
    ).toThrow(AssistantTurnConflictError);
  });

  it("enforces forward-only turn transitions", () => {
    const turns = new AssistantTurnRepository(db.client);
    const { turn } = turns.create({
      workspaceId: "w_demo",
      modelProfileId: "profile_1",
      idempotencyKey: "key_1",
      message: "Hello",
    });
    const building = turns.updateState(turn.id, "building_context", {
      contextPackId: "ctx_1",
    });

    expect(building).toEqual(expect.objectContaining({ state: "building_context", contextPackId: "ctx_1" }));
    expect(() => turns.updateState(turn.id, "queued")).toThrow(/invalid turn transition/);
  });
});
