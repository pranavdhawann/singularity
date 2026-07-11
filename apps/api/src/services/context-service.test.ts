import { createEvent } from "@future/core";
import { CompactionRepository, ContextPackRepository, EmbeddingRepository, EventRepository, MemoryRepository, createTestDb } from "@future/db";
import { EmbeddingAdapterError, indexSearchChunk, type EmbeddingAdapter } from "@future/retrieval";
import { describe, expect, it } from "vitest";
import { ContextService } from "./context-service";

describe("ContextService", () => {
  it("persists approved memory, document, and prior event context for one workspace", async () => {
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

      const pack = await new ContextService({ db: db.client, events, contextPacks: packs }).buildForTurn({
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
      expect(pack.retrieval).toEqual({ mode: "lexical", fallbackReason: "not_configured" });
      expect(pack.items.every((item) => item.retrieval?.reasons.includes("source_quality"))).toBe(true);
      expect(packs.get(pack.id)).toEqual(pack);
    } finally {
      db.close();
    }
  });

  it("uses optional vectors, persists explanations, and falls back safely", async () => {
    const db = createTestDb();
    try {
      const memories = new MemoryRepository(db.client);
      memories.create({ workspaceId: "w_demo", type: "fact", statement: "shared ordinary fact",
        confidence: 1, reviewState: "approved", sourceIds: [] });
      memories.create({ workspaceId: "w_demo", type: "fact", statement: "semantic preferred answer",
        confidence: 1, reviewState: "approved", sourceIds: [] });
      const contextPacks = new ContextPackRepository(db.client);
      const events = new EventRepository(db.client);
      const embeddings = new EmbeddingRepository(db.client);
      const adapter: EmbeddingAdapter = {
        id: "ollama",
        async embed(input) {
          return { available: true, vectors: input.texts.map((text, index) =>
            index === 0 || text.includes("preferred") ? [1, 0] : [0, 1]) };
        }
      };
      const profile = { id: "p1", providerId: "provider_1", name: "Hybrid", model: "mock",
        embeddingModel: "embed", contextWindow: 4096, purpose: "general", privacyPolicy: "local_only" as const,
        createdAt: "2026-07-11T00:00:00.000Z", updatedAt: "2026-07-11T00:00:00.000Z" };
      const service = new ContextService({ db: db.client, events, contextPacks, embeddings,
        embeddingResolver: { getEmbeddingRuntime: () => ({ adapter, model: "embed" }) } });
      const hybrid = await service.buildForTurn({ turnId: "t1", workspaceId: "w_demo", userEventId: "current",
        query: "shared fact", providerId: "provider_1", profile });
      expect(hybrid.retrieval).toEqual({ mode: "hybrid", fallbackReason: null });
      expect(hybrid.items.some((item) => item.text.includes("preferred"))).toBe(true);
      expect(hybrid.items.find((item) => item.text.includes("preferred"))?.retrieval?.vectorScore).toBe(1);
      expect(hybrid.items[0]?.retrieval?.vectorScore).toBeDefined();

      const failing = new ContextService({ db: db.client, events, contextPacks,
        embeddingResolver: { getEmbeddingRuntime: () => ({ adapter: {
          id: "ollama", async embed() { throw new EmbeddingAdapterError("unavailable"); }
        }, model: "embed" }) } });
      const fallback = await failing.buildForTurn({ turnId: "t2", workspaceId: "w_demo", userEventId: "current",
        query: "shared fact", providerId: "provider_1", profile });
      expect(fallback.retrieval).toEqual({ mode: "lexical", fallbackReason: "unavailable" });
      expect(contextPacks.get(hybrid.id)).toEqual(hybrid);
    } finally { db.close(); }
  });

  it("retrieves an active compaction while suppressing its represented memory", async () => {
    const db = createTestDb();
    try {
      const memories = new MemoryRepository(db.client);
      const memory = memories.create({ workspaceId: "w_demo", type: "summary", statement: "SQLite architecture decision",
        confidence: 1, reviewState: "approved", sourceIds: [] });
      const hash = db.client.prepare<{ id: string }, { content_hash: string }>(
        "SELECT content_hash FROM memories WHERE id = @id"
      ).get({ id: memory.id })!.content_hash;
      const compactions = new CompactionRepository(db.client);
      const compaction = compactions.create({ workspaceId: "w_demo", summary: "SQLite remains the architecture source of truth",
        sources: [{ kind: "memory", id: memory.id, contentHash: hash }] });
      const packs = new ContextPackRepository(db.client);
      const pack = await new ContextService({ db: db.client, events: new EventRepository(db.client),
        contextPacks: packs, compactions }).buildForTurn({ turnId: "t1", workspaceId: "w_demo",
        userEventId: "current", query: "SQLite architecture", providerId: "provider_1",
        profile: { id: "p1", providerId: "provider_1", name: "Mock", model: "mock", contextWindow: 4096,
          purpose: "general", privacyPolicy: "local_only", createdAt: "2026-07-11T00:00:00.000Z",
          updatedAt: "2026-07-11T00:00:00.000Z" } });
      expect(pack.items.map((item) => item.source.id)).toContain(compaction.id);
      expect(pack.items.map((item) => item.source.id)).not.toContain(memory.id);
    } finally { db.close(); }
  });
});
