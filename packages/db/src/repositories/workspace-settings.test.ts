import { describe, expect, it } from "vitest";
import { createTestDb } from "../test-db";
import { WorkspaceSettingsRepository } from "./workspace-settings";

describe("WorkspaceSettingsRepository", () => {
  it("returns defaults when no row exists for the workspace", () => {
    const db = createTestDb();
    try {
      const repository = new WorkspaceSettingsRepository(db.client);
      expect(repository.get("w_1")).toEqual({ redactLocalToo: false, autoCapture: true });
    } finally {
      db.close();
    }
  });

  it("persists updates and round-trips them through get", () => {
    const db = createTestDb();
    try {
      const repository = new WorkspaceSettingsRepository(db.client);
      const updated = repository.update("w_1", { autoCapture: false });
      expect(updated).toEqual({ redactLocalToo: false, autoCapture: false });
      expect(repository.get("w_1")).toEqual({ redactLocalToo: false, autoCapture: false });

      const updatedAgain = repository.update("w_1", { redactLocalToo: true });
      expect(updatedAgain).toEqual({ redactLocalToo: true, autoCapture: false });
      expect(repository.get("w_1")).toEqual({ redactLocalToo: true, autoCapture: false });
    } finally {
      db.close();
    }
  });

  it("keeps settings isolated per workspace", () => {
    const db = createTestDb();
    try {
      const repository = new WorkspaceSettingsRepository(db.client);
      repository.update("w_1", { autoCapture: false });
      expect(repository.get("w_2")).toEqual({ redactLocalToo: false, autoCapture: true });
    } finally {
      db.close();
    }
  });
});
