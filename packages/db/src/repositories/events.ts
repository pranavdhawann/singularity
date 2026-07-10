import type { EventActor, SourceReference, TimelineEvent } from "@future/core";
import type { SqliteDatabase } from "../connection";

interface EventRow {
  id: string;
  workspace_id: string;
  type: string;
  actor: EventActor;
  title: string;
  payload_json: string;
  privacy_json: string;
  created_at: string;
}

export interface EventListOptions {
  workspaceId?: string;
  type?: string;
  limit?: number;
  after?: string;
  order?: "asc" | "desc";
}

interface EventCursorRow {
  id: string;
  created_at: string;
}

interface EventSourceRow {
  source_json: string;
}

export class EventRepository {
  constructor(private readonly db: SqliteDatabase) {}

  append(event: TimelineEvent): void {
    const insert = this.db.transaction((nextEvent: TimelineEvent) => {
      this.appendInCurrentTransaction(nextEvent);
    });

    insert(event);
  }

  appendInCurrentTransaction(event: TimelineEvent): void {
    this.db
      .prepare(
        `INSERT INTO events (
          id,
          workspace_id,
          type,
          actor,
          title,
          payload_json,
          privacy_json,
          created_at
        ) VALUES (
          @id,
          @workspaceId,
          @type,
          @actor,
          @title,
          @payloadJson,
          @privacyJson,
          @createdAt
        )`
      )
      .run({
        id: event.id,
        workspaceId: event.workspaceId,
        type: event.type,
        actor: event.actor,
        title: event.title,
        payloadJson: JSON.stringify(event.payload),
        privacyJson: JSON.stringify(event.privacy),
        createdAt: event.createdAt.toISOString()
      });
  }

  list(options: EventListOptions = {}): TimelineEvent[] {
    const where: string[] = [];
    const params: Record<string, string | number> = {
      limit: options.limit ?? 100
    };

    if (options.workspaceId) {
      where.push("workspace_id = @workspaceId");
      params.workspaceId = options.workspaceId;
    }

    if (options.type) {
      where.push("type = @type");
      params.type = options.type;
    }

    const order = options.order ?? "desc";
    if (options.after) {
      const cursor = this.db.prepare<{ id: string }, EventCursorRow>(
        "SELECT id, created_at FROM events WHERE id = @id"
      ).get({ id: options.after });
      if (cursor) {
        params.cursorCreatedAt = cursor.created_at;
        params.cursorId = cursor.id;
        where.push(
          order === "asc"
            ? "(created_at > @cursorCreatedAt OR (created_at = @cursorCreatedAt AND id > @cursorId))"
            : "(created_at < @cursorCreatedAt OR (created_at = @cursorCreatedAt AND id < @cursorId))"
        );
      }
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const rows = this.db
      .prepare<Record<string, string | number>, EventRow>(
        `SELECT id, workspace_id, type, actor, title, payload_json, privacy_json, created_at
         FROM events
         ${whereSql}
         ORDER BY created_at ${order === "asc" ? "ASC" : "DESC"}, id ${order === "asc" ? "ASC" : "DESC"}
         LIMIT @limit`
      )
      .all(params);

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      type: row.type,
      actor: row.actor,
      title: row.title,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      privacy: JSON.parse(row.privacy_json) as Record<string, unknown>,
      createdAt: new Date(row.created_at)
    }));
  }

  attachSources(eventId: string, sources: readonly SourceReference[]): void {
    const attach = this.db.transaction(() => {
      this.attachSourcesInCurrentTransaction(eventId, sources);
    });
    attach();
  }

  attachSourcesInCurrentTransaction(eventId: string, sources: readonly SourceReference[]): void {
    const insert = this.db.prepare(
      `INSERT INTO assistant_response_sources (
        event_id, source_kind, source_id, source_json, ordinal
      ) VALUES (
        @eventId, @sourceKind, @sourceId, @sourceJson, @ordinal
      )`
    );
    sources.forEach((source, ordinal) => {
      insert.run({
        eventId,
        sourceKind: source.kind,
        sourceId: source.id,
        sourceJson: JSON.stringify(source),
        ordinal
      });
    });
  }

  listSources(eventId: string): SourceReference[] {
    return this.db.prepare<{ eventId: string }, EventSourceRow>(
      `SELECT source_json FROM assistant_response_sources
       WHERE event_id = @eventId ORDER BY ordinal ASC`
    ).all({ eventId }).map((row) => JSON.parse(row.source_json) as SourceReference);
  }
}
