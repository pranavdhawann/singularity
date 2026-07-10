import { createEvent } from "@future/core";
import { ContextPackRepository, EventRepository, createTestDb } from "@future/db";
import { indexSearchChunk } from "@future/retrieval";
import { describe, expect, it } from "vitest";
import { ContextService } from "./context-service";

describe("ContextService", () => {
  it("persists approved memory, document, and prior event context for one workspace", () => {
    const db = createTestDb();
    try {
      const events = new EventRepository(db.client);
      const packs = new ContextPackRepository(db.client);
      const now = "2026-07-10T12:00:00.000Z";
      const insertMemory = db.client.prepare(
        `INSERT INTO memories (
          id, workspace_id, type, statement, summary, confidence, scope_json,
          privacy_json, review_state, pinned, outdated_at, last_confirmed_at,
          created_at, updated_at
        ) VALUES (
          @id, @workspaceId, 'decision', @statement, NULL, @confidence, '{}',
          '{"labels":["local"]}', @reviewState, 0, NULL, NULL, @createdAt, @updatedAt
        )`
      );
      insertMemory.run({ id: "mem_approved", workspaceId: "w_demo", statement: "SQLite is the local decision.", confidence: 0.95, reviewState: "approved", createdAt: now, updatedAt: now });
      insertMemory.run({ id: "mem_proposed", workspaceId: "w_demo", statement: "SQLite proposed local decision.", confidence: 0.99, reviewState: "proposed", createdAt: now, updatedAt: now });
      insertMemory.run({ id: "mem_other", workspaceId: "w_other", statement: "SQLite other local decision.", confidence: 0.99, reviewState: "approved", createdAt: now, updatedAt: now });

      indexSearchChunk(db.client, {
        chunkId: "chunk_1",
        documentId: "doc_1",
        workspaceId: "w_demo",
        title: "Architecture notes",
        text: "SQLite captures the local architecture decision.",
        chunkIndex: 0,
        tokenCount: 7,
        hash: "document-hash",
        sourceRange: { start: 0, end: 48 }
      });
      events.append(createEvent({
        workspaceId: "w_demo",
        type: "assistant.response.created",
        actor: "assistant",
        title: "Prior answer",
        payload: { responseText: "SQLite was our earlier local decision." },
        privacy: { labels: ["local"] }
      }));
      events.append({
        id: "evt_current",
        workspaceId: "w_demo",
        type: "user.message.created",
        actor: "user",
        title: "Current question",
        payload: { text: "SQLite local decision" },
        privacy: { labels: ["local"] },
        createdAt: new Date("2026-07-10T12:01:00.000Z")
      });

      const pack = new ContextService({ db: db.client, events, contextPacks: packs }).buildForTurn({
        turnId: "turn_1",
        workspaceId: "w_demo",
        userEventId: "evt_current",
        query: "SQLite local decision",
        providerId: "provider_1",
        profile: {
          id: "profile_1",
          providerId: "provider_1",
          name: "Mock",
          model: "mock",
          contextWindow: 4096,
          purpose: "general",
          privacyPolicy: "local_only",
          createdAt: now,
          updatedAt: now
        }
      });

      expect(pack.items.map((item) => item.source.kind)).toEqual(
        expect.arrayContaining(["memory", "document_chunk", "timeline_event"])
      );
      expect(pack.items.map((item) => item.source.id)).toContain("mem_approved");
      expect(pack.items.map((item) => item.source.id)).not.toContain("mem_proposed");
      expect(pack.items.map((item) => item.source.id)).not.toContain("mem_other");
      expect(pack.items.map((item) => item.source.id)).not.toContain("evt_current");
      expect(packs.get(pack.id)).toEqual(pack);
    } finally {
      db.close();
    }
  });
});
