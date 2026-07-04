import type { EventActor, TimelineEvent } from "@future/core";
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

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const rows = this.db
      .prepare<Record<string, string | number>, EventRow>(
        `SELECT id, workspace_id, type, actor, title, payload_json, privacy_json, created_at
         FROM events
         ${whereSql}
         ORDER BY created_at DESC, id DESC
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
}
