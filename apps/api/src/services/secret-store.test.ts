import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  it("encrypts secrets at rest so the plaintext never touches disk", () => {
    const path = join(dir, "secrets.json");
    const store = new FileSecretStore(path, { masterKey: "test-master-key" });
    store.set("FUTURE_OPENAI_API_KEY", "sk-super-secret-value");

    const onDisk = readFileSync(path, "utf8");
    expect(onDisk).not.toContain("sk-super-secret-value");
    expect(onDisk).not.toContain("FUTURE_OPENAI_API_KEY");
    expect(onDisk).toContain("aes-256-gcm");

    const reopened = new FileSecretStore(path, { masterKey: "test-master-key" });
    expect(reopened.get("FUTURE_OPENAI_API_KEY")).toBe("sk-super-secret-value");
    expect(reopened.list()).toEqual(["FUTURE_OPENAI_API_KEY"]);
  });

  it("fails closed when opened with the wrong master key", () => {
    const path = join(dir, "secrets.json");
    new FileSecretStore(path, { masterKey: "correct-key" }).set("A", "1");
    expect(new FileSecretStore(path, { masterKey: "wrong-key" }).get("A")).toBeUndefined();
  });

  it("reads a legacy plaintext secrets file and re-encrypts it on the next write", () => {
    const path = join(dir, "secrets.json");
    writeFileSync(path, JSON.stringify({ LEGACY: "plain-value" }, null, 2));

    const store = new FileSecretStore(path, { masterKey: "k" });
    expect(store.get("LEGACY")).toBe("plain-value");

    store.set("NEW", "2");
    const onDisk = readFileSync(path, "utf8");
    expect(onDisk).not.toContain("plain-value");
    const reopened = new FileSecretStore(path, { masterKey: "k" });
    expect(reopened.get("LEGACY")).toBe("plain-value");
    expect(reopened.get("NEW")).toBe("2");
  });

  it("auto-manages a sidecar key so default instances round-trip encrypted data", () => {
    const path = join(dir, "secrets.json");
    new FileSecretStore(path).set("A", "1");
    expect(new FileSecretStore(path).get("A")).toBe("1");
    expect(readFileSync(path, "utf8")).toContain("aes-256-gcm");
  });
});
