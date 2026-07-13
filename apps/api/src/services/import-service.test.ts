import { createHash } from "node:crypto";
import { EventRepository, ImportJobRepository, createTestDb } from "@future/db";
import { describe, expect, it } from "vitest";
import { ImportService } from "./import-service";

function setup() {
  const db = createTestDb();
  const jobs = new ImportJobRepository(db.client);
  const events = new EventRepository(db.client);
  return {
    db,
    jobs,
    events,
    service: new ImportService({ db: db.client, jobs, events })
  };
}

describe("ImportService", () => {
  it("resumes after a committed chunk without duplicating indexed work or events", async () => {
    const ctx = setup();
    try {
      const importedText = "alpha ".repeat(500);
      const created = ctx.service.enqueueFile({
        workspaceId: "w_1",
        filename: "long.txt",
        mediaType: "text/plain",
        kind: "text",
        content: Buffer.from(importedText)
      });
      let committed = 0;

      await expect(ctx.service.run(created.id, {
        afterChunkCommitted: () => {
          committed += 1;
          if (committed === 1) throw new Error("simulated interruption");
        }
      })).rejects.toThrow("simulated interruption");

      const failed = ctx.jobs.get(created.id)!;
      expect(failed.state).toBe("failed");
      expect(failed.nextChunkIndex).toBe(1);
      expect(ctx.db.client.prepare("SELECT COUNT(*) FROM document_chunks").pluck().get()).toBe(1);
      expect(ctx.db.client.prepare("SELECT COUNT(*) FROM document_chunks_fts").pluck().get()).toBe(1);

      ctx.service.retry(created.id);
      const completed = await ctx.service.run(created.id);

      expect(completed.state).toBe("completed");
      expect(ctx.db.client.prepare("SELECT COUNT(*) FROM documents").pluck().get()).toBe(1);
      expect(ctx.db.client.prepare("SELECT hash FROM documents").pluck().get()).toBe(
        createHash("sha256").update(importedText).digest("hex")
      );
      expect(ctx.db.client.prepare("SELECT COUNT(*) FROM document_chunks WHERE content_hash = ''").pluck().get()).toBe(0);
      expect(ctx.db.client.prepare("SELECT COUNT(*) FROM document_chunks").pluck().get()).toBe(3);
      expect(ctx.db.client.prepare("SELECT COUNT(*) FROM document_chunks_fts").pluck().get()).toBe(3);
      expect(ctx.events.list({ workspaceId: "w_1", type: "document.imported" })).toHaveLength(1);
      expect(ctx.events.list({ workspaceId: "w_1", type: "import.finished" })).toHaveLength(1);
    } finally {
      ctx.db.close();
    }
  });

  it("keeps a valid file when a sibling payload cannot be parsed", async () => {
    const ctx = setup();
    try {
      const valid = ctx.service.enqueueFile({
        workspaceId: "w_1", filename: "notes.md", mediaType: "text/markdown",
        kind: "markdown", content: Buffer.from("# Notes\nUse SQLite")
      });
      const invalid = ctx.service.enqueueFile({
        workspaceId: "w_1", filename: "chatgpt.json", mediaType: "application/json",
        kind: "chatgpt", content: Buffer.from("not json")
      });

      await expect(ctx.service.run(valid.id)).resolves.toMatchObject({ state: "completed" });
      await expect(ctx.service.run(invalid.id)).rejects.toThrow();

      expect(ctx.jobs.get(valid.id)?.state).toBe("completed");
      expect(ctx.jobs.get(invalid.id)).toMatchObject({ state: "failed", errorCode: "parse_failed" });
      expect(ctx.db.client.prepare("SELECT COUNT(*) FROM documents").pluck().get()).toBe(1);
    } finally {
      ctx.db.close();
    }
  });

  it("uses a one-shot configured interruption to prove browser retry behavior", async () => {
    const ctx = setup();
    try {
      const service = new ImportService({
        db: ctx.db.client, jobs: ctx.jobs, events: ctx.events, failAfterChunks: 1
      });
      const job = service.enqueueFile({
        workspaceId: "w_1", filename: "resume.txt", mediaType: "text/plain",
        kind: "text", content: Buffer.from("resumable ".repeat(400))
      });

      await expect(service.run(job.id)).rejects.toThrow("configured import interruption");
      service.retry(job.id);
      await expect(service.run(job.id)).resolves.toMatchObject({ state: "completed" });
      expect(ctx.db.client.prepare("SELECT COUNT(*) FROM document_chunks").pluck().get()).toBe(4);
    } finally {
      ctx.db.close();
    }
  });
});
