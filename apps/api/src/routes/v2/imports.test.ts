import { describe, expect, it } from "vitest";
import { createServer } from "../../server/create-server";

const protectedHeaders = {
  "x-future-session": "test-token",
  origin: "http://127.0.0.1:4173",
};

describe("V2 import routes", () => {
  it("accepts supported files and returns persisted per-file jobs", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const multipart = createMultipart({ workspaceId: "w_1" }, [
      { name: "files", filename: "notes.md", contentType: "text/markdown", content: "# Notes\nUse SQLite" },
      { name: "files", filename: "plain.txt", contentType: "text/plain", content: "Local text" },
    ]);

    const response = await server.inject({
      method: "POST",
      url: "/api/v2/imports",
      headers: { ...protectedHeaders, "content-type": multipart.contentType },
      payload: multipart.body,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<{ files: Array<{ filename: string; job: { id: string; state: string } }> }>();
    expect(body.files).toEqual([
      expect.objectContaining({ filename: "notes.md", job: expect.objectContaining({ state: "queued" }) }),
      expect.objectContaining({ filename: "plain.txt", job: expect.objectContaining({ state: "queued" }) }),
    ]);

    const list = await server.inject({ method: "GET", url: "/api/v2/imports?workspaceId=w_1" });
    expect(list.json<{ jobs: unknown[] }>().jobs).toHaveLength(2);
    await server.close();
  });

  it("keeps valid files when a sibling type is unsupported", async () => {
    const server = await createServer({ databasePath: ":memory:", sessionToken: "test-token" });
    const multipart = createMultipart({ workspaceId: "w_1" }, [
      { name: "files", filename: "notes.md", contentType: "text/markdown", content: "# Valid" },
      { name: "files", filename: "image.png", contentType: "image/png", content: "not an image" },
    ]);
    const response = await server.inject({
      method: "POST",
      url: "/api/v2/imports",
      headers: { ...protectedHeaders, "content-type": multipart.contentType },
      payload: multipart.body,
    });

    expect(response.statusCode).toBe(207);
    expect(response.json()).toEqual({
      files: [
        expect.objectContaining({ filename: "notes.md", job: expect.any(Object) }),
        { filename: "image.png", errorCode: "unsupported_file" },
      ],
    });
    await server.close();
  });

  it("protects multipart mutations with the local session and origin checks", async () => {
    const server = await createServer({
      databasePath: ":memory:",
      sessionToken: "test-token",
      allowedOrigins: ["http://127.0.0.1:4173"],
    });
    const multipart = createMultipart({ workspaceId: "w_1" }, [
      { name: "files", filename: "notes.txt", contentType: "text/plain", content: "safe" },
    ]);
    const unauthorized = await server.inject({
      method: "POST",
      url: "/api/v2/imports",
      headers: { "content-type": multipart.contentType },
      payload: multipart.body,
    });
    const forbidden = await server.inject({
      method: "POST",
      url: "/api/v2/imports",
      headers: {
        "content-type": multipart.contentType,
        "x-future-session": "test-token",
        origin: "https://evil.example",
      },
      payload: multipart.body,
    });

    expect(unauthorized.statusCode).toBe(401);
    expect(forbidden.statusCode).toBe(403);
    await server.close();
  });
});

function createMultipart(
  fields: Record<string, string>,
  files: Array<{ name: string; filename: string; contentType: string; content: string }>,
): { body: Buffer; contentType: string } {
  const boundary = "future-phase4-boundary";
  const chunks: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  for (const file of files) {
    chunks.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n` +
        `Content-Type: ${file.contentType}\r\n\r\n${file.content}\r\n`,
    );
  }
  chunks.push(`--${boundary}--\r\n`);
  return {
    body: Buffer.from(chunks.join("")),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}
