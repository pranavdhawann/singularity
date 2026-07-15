import type { SqliteDatabase } from "../connection";

export interface WorkspaceSettings {
  redactLocalToo: boolean;
  autoCapture: boolean;
}

export type WorkspaceSettingsUpdate = Partial<WorkspaceSettings>;

const DEFAULT_SETTINGS: WorkspaceSettings = {
  redactLocalToo: false,
  autoCapture: true,
};

interface WorkspaceSettingsRow {
  workspace_id: string;
  redact_local_too: number;
  auto_capture: number;
}

export class WorkspaceSettingsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  get(workspaceId: string): WorkspaceSettings {
    const row = this.db
      .prepare<{ workspaceId: string }, WorkspaceSettingsRow>(
        "SELECT * FROM workspace_settings WHERE workspace_id = @workspaceId",
      )
      .get({ workspaceId });
    return row ? mapSettings(row) : { ...DEFAULT_SETTINGS };
  }

  update(workspaceId: string, update: WorkspaceSettingsUpdate): WorkspaceSettings {
    const current = this.get(workspaceId);
    const next: WorkspaceSettings = {
      redactLocalToo: update.redactLocalToo ?? current.redactLocalToo,
      autoCapture: update.autoCapture ?? current.autoCapture,
    };
    this.db
      .prepare(
        `INSERT INTO workspace_settings (workspace_id, redact_local_too, auto_capture)
       VALUES (@workspaceId, @redactLocalToo, @autoCapture)
       ON CONFLICT (workspace_id) DO UPDATE SET
         redact_local_too = excluded.redact_local_too,
         auto_capture = excluded.auto_capture`,
      )
      .run({
        workspaceId,
        redactLocalToo: next.redactLocalToo ? 1 : 0,
        autoCapture: next.autoCapture ? 1 : 0,
      });
    return next;
  }
}

function mapSettings(row: WorkspaceSettingsRow): WorkspaceSettings {
  return {
    redactLocalToo: row.redact_local_too === 1,
    autoCapture: row.auto_capture === 1,
  };
}
