import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { createServer } from "./server/create-server";

const databasePath = process.env.FUTURE_DB_PATH ?? ".future/future.sqlite";
const port = Number.parseInt(process.env.PORT ?? "4174", 10);

await mkdir(dirname(databasePath), { recursive: true });

const allowedOrigins = (process.env.FUTURE_ALLOWED_ORIGINS ?? "http://127.0.0.1:4173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const server = await createServer({ databasePath, sessionToken: randomUUID(), allowedOrigins });
await server.listen({ host: "127.0.0.1", port });

console.log(`Future API listening on http://127.0.0.1:${port}`);
