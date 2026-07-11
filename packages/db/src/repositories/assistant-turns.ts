import {
  createEvent,
  createId,
  type AssistantTurnDto,
  type AssistantTurnState,
  type CreateAssistantTurnInput
} from "@future/core";
import type { SqliteDatabase } from "../connection";
import { EventRepository } from "./events";

interface AssistantTurnRow {
  id: string;
  workspace_id: string;
  model_profile_id: string;
  idempotency_key: string;
  state: AssistantTurnState;
  user_event_id: string;
  context_pack_id: string | null;
  model_call_id: string | null;
  assistant_event_id: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantTurnReferences {
  contextPackId?: string;
  modelCallId?: string;
  assistantEventId?: string;
  errorCode?: string;
}

const allowedTransitions: Record<AssistantTurnState, readonly AssistantTurnState[]> = {
  queued: ["building_context", "cancelled"],
  building_context: ["awaiting_approval", "running", "failed", "cancelled"],
  awaiting_approval: ["running", "failed", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: []
};

export class AssistantTurnConflictError extends Error {
  constructor() {
    super("idempotency key already belongs to different assistant input");
    this.name = "AssistantTurnConflictError";
  }
}

export class AssistantTurnRepository {
  private readonly events: EventRepository;

  constructor(private readonly db: SqliteDatabase) {
    this.events = new EventRepository(db);
  }

  create(input: CreateAssistantTurnInput): { turn: AssistantTurnDto; replayed: boolean } {
    const existing = this.getByIdempotencyKey(input.workspaceId, input.idempotencyKey);
    if (existing) {
      const event = this.events.list({ workspaceId: input.workspaceId, limit: 1000 })
        .find((candidate) => candidate.id === existing.userEventId);
      if (existing.modelProfileId !== input.modelProfileId || event?.payload.text !== input.message) {
        throw new AssistantTurnConflictError();
      }
      return { turn: existing, replayed: true };
    }

    const now = new Date().toISOString();
    const turnId = createId("turn");
    const userEvent = createEvent({
      workspaceId: input.workspaceId,
      type: "user.message.created",
      actor: "user",
      title: "Message to Future",
      payload: { text: input.message, turnId },
      privacy: { labels: ["local"] }
    });

    const insert = this.db.transaction(() => {
      this.events.appendInCurrentTransaction(userEvent);
      this.db.prepare(
        `INSERT INTO assistant_turns (
          id, workspace_id, model_profile_id, idempotency_key, state,
          user_event_id, context_pack_id, model_call_id, assistant_event_id,
          error_code, created_at, updated_at
        ) VALUES (
          @id, @workspaceId, @modelProfileId, @idempotencyKey, 'queued',
          @userEventId, NULL, NULL, NULL, NULL, @createdAt, @updatedAt
        )`
      ).run({
        id: turnId,
        workspaceId: input.workspaceId,
        modelProfileId: input.modelProfileId,
        idempotencyKey: input.idempotencyKey,
        userEventId: userEvent.id,
        createdAt: now,
        updatedAt: now
      });
    });
    insert();

    const turn = this.get(turnId);
    if (!turn) throw new Error("assistant turn insert failed");
    return { turn, replayed: false };
  }

  get(id: string): AssistantTurnDto | undefined {
    return mapRow(
      this.db.prepare<{ id: string }, AssistantTurnRow>("SELECT * FROM assistant_turns WHERE id = @id")
        .get({ id })
    );
  }

  getByIdempotencyKey(workspaceId: string, key: string): AssistantTurnDto | undefined {
    return mapRow(
      this.db.prepare<{ workspaceId: string; key: string }, AssistantTurnRow>(
        "SELECT * FROM assistant_turns WHERE workspace_id = @workspaceId AND idempotency_key = @key"
      ).get({ workspaceId, key })
    );
  }

  updateState(
    id: string,
    state: AssistantTurnState,
    references: AssistantTurnReferences = {}
  ): AssistantTurnDto {
    const current = this.get(id);
    if (!current) throw new Error(`assistant turn not found: ${id}`);
    if (!allowedTransitions[current.state].includes(state)) {
      throw new Error(`invalid turn transition: ${current.state} -> ${state}`);
    }

    this.db.prepare(
      `UPDATE assistant_turns SET
        state = @state,
        context_pack_id = COALESCE(@contextPackId, context_pack_id),
        model_call_id = COALESCE(@modelCallId, model_call_id),
        assistant_event_id = COALESCE(@assistantEventId, assistant_event_id),
        error_code = COALESCE(@errorCode, error_code),
        updated_at = @updatedAt
       WHERE id = @id`
    ).run({
      id,
      state,
      contextPackId: references.contextPackId ?? null,
      modelCallId: references.modelCallId ?? null,
      assistantEventId: references.assistantEventId ?? null,
      errorCode: references.errorCode ?? null,
      updatedAt: new Date().toISOString()
    });

    const updated = this.get(id);
    if (!updated) throw new Error(`assistant turn not found after update: ${id}`);
    return updated;
  }
}

function mapRow(row: AssistantTurnRow | undefined): AssistantTurnDto | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    modelProfileId: row.model_profile_id,
    idempotencyKey: row.idempotency_key,
    state: row.state,
    userEventId: row.user_event_id,
    ...(row.context_pack_id ? { contextPackId: row.context_pack_id } : {}),
    ...(row.model_call_id ? { modelCallId: row.model_call_id } : {}),
    ...(row.assistant_event_id ? { assistantEventId: row.assistant_event_id } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
