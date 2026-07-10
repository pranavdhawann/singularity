import { createHash } from "node:crypto";
import { schemaStatements } from "../schema";
import type { Migration } from "./types";

const checksum = createHash("sha256").update(schemaStatements.join("\n")).digest("hex");

export const initialMigration: Migration = {
  id: "0001_initial",
  checksum,
  up(db) {
    for (const statement of schemaStatements) {
      db.exec(statement);
    }
  }
};
