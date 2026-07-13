import { createEvent, createId, type MemoryReviewState, type MemoryType } from "@future/core";
import { transitionMemory } from "@future/memory";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../server/dependencies";

interface MemoryRow {
  id: string;
  workspace_id: string;
  type: MemoryType;
  statement: string;
  summary: string | null;
  confidence: number;
  scope_json: string;
  privacy_json: string;
  review_state: MemoryReviewState;
  pinned: 0 | 1;
  outdated_at: string | null;
  last_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MemoryResponse {
  id: string;
  workspaceId: string;
  type: MemoryType;
  statement: string;
  confidence: number;
  reviewState: MemoryReviewState;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  summary?: string;
  sourceCount?: number;
}

interface MemoryQuery {
  workspaceId?: string;
  type?: MemoryType;
  reviewState?: MemoryReviewState;
  q?: string;
}

interface CreateMemoryBody {
  workspaceId: string;
  type: MemoryType;
  statement: string;
  confidence?: number;
  summary?: string;
}

interface PatchMemoryBody {
  statement?: string;
  confidence?: number;
  pinned?: boolean;
  reviewState?: MemoryReviewState;
}

interface MemoryParams {
  id: string;
}

export async function registerMemoryRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  server.get<{ Querystring: MemoryQuery }>("/api/memories", async (request) => {
    const where: string[] = [];
    const params: Record<string, string> = {};

    if (request.query.workspaceId) {
      where.push("workspace_id = @workspaceId");
      params.workspaceId = request.query.workspaceId;
    }

    if (request.query.type) {
      where.push("type = @type");
      params.type = request.query.type;
    }

    if (request.query.reviewState) {
      where.push("review_state = @reviewState");
      params.reviewState = request.query.reviewState;
    }

    if (request.query.q) {
      where.push("statement LIKE @q");
      params.q = `%${request.query.q}%`;
    }

    const rows = deps.db
      .prepare<Record<string, string>, MemoryRow>(
        `SELECT *
         FROM memories
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY pinned DESC, updated_at DESC`,
      )
      .all(params);

    return { memories: rows.map(rowToMemory) };
  });

  server.post<{ Body: CreateMemoryBody }>(
    "/api/memories",
    {
      schema: {
        body: {
          type: "object",
          required: ["workspaceId", "type", "statement"],
          properties: {
            workspaceId: { type: "string" },
            type: { type: "string" },
            statement: { type: "string", minLength: 1 },
            confidence: { type: "number" },
            summary: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const now = new Date().toISOString();
      const memory = {
        id: createId("mem"),
        workspaceId: request.body.workspaceId,
        type: request.body.type,
        statement: request.body.statement,
        summary: request.body.summary ?? null,
        confidence: request.body.confidence ?? 0.5,
        reviewState: "proposed" as MemoryReviewState,
        createdAt: now,
        updatedAt: now,
      };

      const insert = deps.db.transaction(() => {
        deps.db
          .prepare(
            `INSERT INTO memories (
              id,
              workspace_id,
              type,
              statement,
              summary,
              confidence,
              scope_json,
              privacy_json,
              review_state,
              pinned,
              outdated_at,
              last_confirmed_at,
              created_at,
              updated_at
            ) VALUES (
              @id,
              @workspaceId,
              @type,
              @statement,
              @summary,
              @confidence,
              '{}',
              '{"labels":["local"]}',
              @reviewState,
              0,
              NULL,
              NULL,
              @createdAt,
              @updatedAt
            )`,
          )
          .run(memory);

        deps.events.appendInCurrentTransaction(
          createEvent({
            workspaceId: memory.workspaceId,
            type: "memory.proposed",
            actor: "assistant",
            title: "Proposed memory",
            payload: { memoryId: memory.id, memoryType: memory.type },
            privacy: { labels: ["local"] },
          }),
        );
      });

      insert();
      return reply.code(201).send({
        id: memory.id,
        workspaceId: memory.workspaceId,
        type: memory.type,
        statement: memory.statement,
        confidence: memory.confidence,
        reviewState: memory.reviewState,
        pinned: false,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
        ...(memory.summary ? { summary: memory.summary } : {}),
      });
    },
  );

  server.post<{ Params: MemoryParams }>("/api/memories/:id/promote", async (request, reply) => {
    const row = getMemory(deps, request.params.id);
    if (!row) return reply.code(404).send({ error: "memory not found" });

    const transition = transitionMemory({
      reviewState: row.review_state,
      action: "approve",
      actor: "user",
    });
    const now = new Date().toISOString();

    const promote = deps.db.transaction(() => {
      deps.db
        .prepare(
          `UPDATE memories
           SET review_state = @reviewState,
               last_confirmed_at = @confirmedAt,
               updated_at = @updatedAt
           WHERE id = @id`,
        )
        .run({
          id: row.id,
          reviewState: transition.reviewState,
          confirmedAt: now,
          updatedAt: now,
        });

      deps.db
        .prepare(
          `INSERT INTO memory_revisions (
            id,
            memory_id,
            previous_json,
            next_json,
            reason,
            created_at
          ) VALUES (
            @id,
            @memoryId,
            @previousJson,
            @nextJson,
            @reason,
            @createdAt
          )`,
        )
        .run({
          id: createId("memrev"),
          memoryId: row.id,
          previousJson: JSON.stringify(rowToMemory(row)),
          nextJson: JSON.stringify({ ...rowToMemory(row), reviewState: transition.reviewState }),
          reason: transition.revisionReason,
          createdAt: now,
        });

      deps.events.appendInCurrentTransaction(
        createEvent({
          workspaceId: row.workspace_id,
          type: "memory.approved",
          actor: "user",
          title: "Approved memory",
          payload: { memoryId: row.id },
          privacy: { labels: ["local"] },
        }),
      );
    });

    promote();
    const updated = getMemory(deps, row.id);
    return updated ? rowToMemory(updated) : reply.code(404).send({ error: "memory not found" });
  });

  server.patch<{ Params: MemoryParams; Body: PatchMemoryBody }>("/api/memories/:id", async (request, reply) => {
    const row = getMemory(deps, request.params.id);
    if (!row) return reply.code(404).send({ error: "memory not found" });

    const next = {
      statement: request.body.statement ?? row.statement,
      confidence: request.body.confidence ?? row.confidence,
      pinned: typeof request.body.pinned === "boolean" ? (request.body.pinned ? 1 : 0) : row.pinned,
      reviewState: request.body.reviewState ?? row.review_state,
      updatedAt: new Date().toISOString(),
    };

    deps.db
      .prepare(
        `UPDATE memories
           SET statement = @statement,
               confidence = @confidence,
               pinned = @pinned,
               review_state = @reviewState,
               updated_at = @updatedAt
           WHERE id = @id`,
      )
      .run({ id: row.id, ...next });

    const updated = getMemory(deps, row.id);
    return updated ? rowToMemory(updated) : reply.code(404).send({ error: "memory not found" });
  });

  server.delete<{ Params: MemoryParams }>("/api/memories/:id", async (request, reply) => {
    const row = getMemory(deps, request.params.id);
    if (!row) return reply.code(404).send({ error: "memory not found" });

    const remove = deps.db.transaction(() => {
      deps.db.prepare("DELETE FROM memory_sources WHERE memory_id = @id").run({ id: row.id });
      deps.db.prepare("DELETE FROM memories WHERE id = @id").run({ id: row.id });
      deps.events.appendInCurrentTransaction(
        createEvent({
          workspaceId: row.workspace_id,
          type: "memory.deleted",
          actor: "user",
          title: "Deleted memory",
          payload: { memoryId: row.id },
          privacy: { labels: ["local"] },
        }),
      );
    });

    remove();
    return reply.code(204).send();
  });
}

function getMemory(deps: ApiDependencies, id: string): MemoryRow | undefined {
  return deps.db.prepare<{ id: string }, MemoryRow>("SELECT * FROM memories WHERE id = @id").get({ id });
}

function rowToMemory(row: MemoryRow): MemoryResponse {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    statement: row.statement,
    confidence: row.confidence,
    reviewState: row.review_state,
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.summary ? { summary: row.summary } : {}),
  };
}
