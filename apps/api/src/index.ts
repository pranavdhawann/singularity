import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createServer } from "./server/create-server";

const databasePath = process.env.FUTURE_DB_PATH ?? ".future/future.sqlite";
const port = Number.parseInt(process.env.PORT ?? "4174", 10);

await mkdir(dirname(databasePath), { recursive: true });

const server = await createServer({ databasePath });
await server.listen({ host: "127.0.0.1", port });

console.log(`Future API listening on http://127.0.0.1:${port}`);
