import { buildContextPack } from "@future/retrieval";
import { redactSensitiveText } from "@future/permissions";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../server/dependencies";

interface PreviewBody {
  workspaceId: string;
  command: string;
  budgetTokens?: number;
}

interface MemoryCandidateRow {
  id: string;
  statement: string;
  confidence: number;
}

export async function registerContextPackRoutes(
  server: FastifyInstance,
  deps: ApiDependencies
): Promise<void> {
  server.post<{ Body: PreviewBody }>("/api/context-packs/preview", async (request) => {
    const commandRedaction = redactSensitiveText(request.body.command);
    const memories = deps.db
      .prepare<{ workspaceId: string }, MemoryCandidateRow>(
        `SELECT id, statement, confidence
         FROM memories
         WHERE workspace_id = @workspaceId
           AND review_state = 'approved'
         ORDER BY pinned DESC, confidence DESC
         LIMIT 12`
      )
      .all({ workspaceId: request.body.workspaceId })
      .map((memory) => ({
        id: memory.id,
        text: memory.statement,
        tokenCount: estimateTokenCount(memory.statement),
        score: memory.confidence * 10
      }));

    const pack = buildContextPack({
      workspaceId: request.body.workspaceId,
      command: commandRedaction.text,
      budgetTokens: request.body.budgetTokens ?? 1200,
      memories,
      chunks: [],
      recentEvents: []
    });

    deps.db
      .prepare(
        `INSERT INTO context_packs (
          id,
          workspace_id,
          command_event_id,
          model_profile_id,
          budget_json,
          items_json,
          redactions_json,
          created_at
        ) VALUES (
          @id,
          @workspaceId,
          NULL,
          NULL,
          @budgetJson,
          @itemsJson,
          @redactionsJson,
          @createdAt
        )`
      )
      .run({
        id: pack.id,
        workspaceId: pack.workspaceId,
        budgetJson: JSON.stringify({ budgetTokens: request.body.budgetTokens ?? 1200 }),
        itemsJson: JSON.stringify(pack.items),
        redactionsJson: JSON.stringify(commandRedaction.redactions),
        createdAt: pack.createdAt.toISOString()
      });

    return { ...pack, redactions: commandRedaction.redactions };
  });
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3));
}
