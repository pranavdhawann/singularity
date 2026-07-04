import { runCommand } from "../services/command-runner";
import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../server/dependencies";

interface CommandBody {
  workspaceId: string;
  command: "ask_with_memory";
  input: string;
  providerId?: string;
}

interface MemoryCandidateRow {
  id: string;
  statement: string;
  confidence: number;
}

export async function registerCommandRoutes(
  server: FastifyInstance,
  deps: ApiDependencies
): Promise<void> {
  server.post<{ Body: CommandBody }>("/api/commands", async (request, reply) => {
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

    const result = await runCommand({
      workspaceId: request.body.workspaceId,
      command: request.body.command,
      input: request.body.input,
      providerId: request.body.providerId ?? "mock",
      memories
    });

    const appendEvents = deps.db.transaction(() => {
      for (const event of result.events) {
        deps.events.appendInCurrentTransaction(event);
      }
    });
    appendEvents();

    return reply.code(201).send(result);
  });
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3));
}
