import { createHash } from "node:crypto";
import type { Migration } from "./types";

const statements = [
  `CREATE TABLE workspace_settings (
    workspace_id TEXT PRIMARY KEY,
    redact_local_too INTEGER NOT NULL DEFAULT 0,
    auto_capture INTEGER NOT NULL DEFAULT 1
  )`,
] as const;

export const workspaceSettingsMigration: Migration = {
  id: "0005_workspace_settings",
  checksum: createHash("sha256").update(statements.join("\n")).digest("hex"),
  up(db) {
    for (const statement of statements) db.exec(statement);
  },
};
