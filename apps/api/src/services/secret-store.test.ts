import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileSecretStore } from "./secret-store";

describe("FileSecretStore", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "future-secrets-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("stores and reads a secret by name", () => {
    const store = new FileSecretStore(join(dir, "secrets.json"));
    store.set("FUTURE_ANTHROPIC_API_KEY", "sk-ant-123");
    expect(store.get("FUTURE_ANTHROPIC_API_KEY")).toBe("sk-ant-123");
    expect(store.list()).toEqual(["FUTURE_ANTHROPIC_API_KEY"]);
  });

  it("persists across instances and returns undefined for missing", () => {
    const path = join(dir, "secrets.json");
    new FileSecretStore(path).set("A", "1");
    expect(new FileSecretStore(path).get("A")).toBe("1");
    expect(new FileSecretStore(path).get("MISSING")).toBeUndefined();
  });

  it("prefers process.env over the file when present", () => {
    const store = new FileSecretStore(join(dir, "secrets.json"));
    store.set("FROM_ENV", "file-value");
    process.env.FROM_ENV = "env-value";
    try {
      expect(store.get("FROM_ENV")).toBe("env-value");
    } finally {
      delete process.env.FROM_ENV;
    }
  });
});
