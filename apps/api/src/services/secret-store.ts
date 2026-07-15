import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SecretStore } from "@future/core";

export interface FileSecretStoreOptions {
  /**
   * Passphrase (or raw key material) used to derive the AES key. Defaults to
   * `process.env.FUTURE_SECRET_KEY`, and finally to an auto-generated key kept
   * in a sidecar file so the store is encrypted with zero configuration.
   */
  masterKey?: string;
  /** Location of the auto-generated sidecar key. Defaults to `${path}.key`. */
  keyPath?: string;
}

interface EncryptedEnvelope {
  v: 1;
  alg: "aes-256-gcm";
  salt: string;
  iv: string;
  tag: string;
  data: string;
}

/**
 * A secret store that encrypts its contents at rest with AES-256-GCM.
 *
 * The AES key is derived (scrypt) from a master key resolved in this order:
 * an explicit `masterKey`, `FUTURE_SECRET_KEY`, or an auto-generated 32-byte
 * sidecar key written next to the store with 0600 permissions. This protects
 * secrets against being read from a copied, synced, or backed-up file; it does
 * not defend against an attacker with full local filesystem access (an OS
 * keychain integration is the intended stronger successor).
 */
export class FileSecretStore implements SecretStore {
  private readonly keyPath: string;
  private readonly explicitKeyMaterial: string | undefined;

  constructor(
    private readonly path: string,
    options: FileSecretStoreOptions = {},
  ) {
    this.explicitKeyMaterial = options.masterKey ?? process.env.FUTURE_SECRET_KEY ?? undefined;
    this.keyPath = options.keyPath ?? `${path}.key`;
  }

  get(name: string): string | undefined {
    if (process.env[name]) return process.env[name];
    return this.read()[name];
  }

  set(name: string, value: string): void {
    const data = this.read();
    data[name] = value;
    this.write(data);
  }

  list(): string[] {
    return Object.keys(this.read());
  }

  private read(): Record<string, string> {
    if (!existsSync(this.path)) return {};
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.path, "utf8"));
    } catch {
      return {};
    }
    if (isEncryptedEnvelope(parsed)) return this.decrypt(parsed);
    // Legacy plaintext store; read as-is and re-encrypt on the next write.
    if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
    return {};
  }

  private write(data: Record<string, string>): void {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.deriveKey(salt), iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
    const envelope: EncryptedEnvelope = {
      v: 1,
      alg: "aes-256-gcm",
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: ciphertext.toString("base64"),
    };
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(envelope, null, 2), { mode: 0o600 });
    harden(this.path);
  }

  private decrypt(envelope: EncryptedEnvelope): Record<string, string> {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.deriveKey(Buffer.from(envelope.salt, "base64")),
        Buffer.from(envelope.iv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]);
      return JSON.parse(plaintext.toString("utf8")) as Record<string, string>;
    } catch {
      // Wrong key or a tampered file: fail closed rather than leak or throw.
      return {};
    }
  }

  private deriveKey(salt: Buffer): Buffer {
    return scryptSync(this.keyMaterial(), salt, 32);
  }

  private keyMaterial(): string {
    if (this.explicitKeyMaterial) return this.explicitKeyMaterial;
    if (existsSync(this.keyPath)) return readFileSync(this.keyPath, "utf8").trim();
    const generated = randomBytes(32).toString("base64");
    mkdirSync(dirname(this.keyPath), { recursive: true });
    writeFileSync(this.keyPath, generated, { mode: 0o600 });
    harden(this.keyPath);
    return generated;
  }
}

function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.v === 1 && record.alg === "aes-256-gcm" && typeof record.data === "string";
}

function harden(target: string): void {
  try {
    chmodSync(target, 0o600);
  } catch {
    // best-effort on platforms without POSIX modes
  }
}
