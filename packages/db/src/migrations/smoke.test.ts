import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runMigrationSmoke } from "./smoke";

describe("runMigrationSmoke", () => {
  it("applies every migration to an isolated temporary database and removes it", async () => {
    const output: string[] = [];

    const result = await runMigrationSmoke({ log: (line) => output.push(line) });

    expect(result.ids).toEqual([
      "0001_initial",
      "0002_continuous_assistant",
      "0003_memory_hybrid_retrieval",
      "0004_imports_external_models",
      "0005_workspace_settings",
    ]);
    expect(output).toEqual(result.ids);
    expect(path.resolve(result.databasePath).startsWith(path.resolve(tmpdir()) + path.sep)).toBe(true);
    expect(existsSync(result.databasePath)).toBe(false);
    expect(existsSync(path.dirname(result.databasePath))).toBe(false);
  });
});
