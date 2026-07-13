import type { FastifyInstance } from "fastify";
import type { ApiDependencies } from "../../server/dependencies";

export async function registerV2HealthRoutes(server: FastifyInstance, deps: ApiDependencies): Promise<void> {
  server.get("/api/v2/health", async () => {
    const migrationCount = deps.db.prepare("SELECT COUNT(*) FROM schema_migrations").pluck().get() as number;

    return {
      ok: true,
      apiVersion: "v2",
      database: { migrationCount },
    };
  });
}
