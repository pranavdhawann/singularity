import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../../server/create-server";

const headers = { "x-future-session": "test-token" };

// createServer resolves the FileSecretStore path relative to the database path's
// directory. A ":memory:" database resolves that directory to ".", i.e. the
// process cwd, so any test that actually writes a secret leaves a real file on
// disk unless it is cleaned up here.
const secretsFilePath = join(dirname(":memory:"), "secrets.json");

afterEach(() => {
  if (existsSync(secretsFilePath)) {
    rmSync(secretsFilePath);
  }
});

describe("V2 secrets routes", () => {
  it("stores a secret value and returns only the list of names, never the value", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });

    const response = await server.inject({
      method: "POST",
      url: "/api/v2/secrets",
      headers,
      payload: { name: "OPENAI_API_KEY", value: "sk-super-secret" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toEqual({ names: ["OPENAI_API_KEY"] });
    expect(JSON.stringify(body)).not.toContain("sk-super-secret");

    await server.close();
  });

  it("rejects requests without a valid session token", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });

    const response = await server.inject({
      method: "POST",
      url: "/api/v2/secrets",
      payload: { name: "OPENAI_API_KEY", value: "sk-super-secret" },
    });

    expect(response.statusCode).toBe(401);

    await server.close();
  });
});
