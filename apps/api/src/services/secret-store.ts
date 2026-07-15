import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SecretStore } from "@future/core";

export class FileSecretStore implements SecretStore {
  constructor(private readonly path: string) {}

  get(name: string): string | undefined {
    if (process.env[name]) return process.env[name];
    return this.read()[name];
  }

  set(name: string, value: string): void {
    const data = this.read();
    data[name] = value;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(data, null, 2), { mode: 0o600 });
    try {
      chmodSync(this.path, 0o600);
    } catch {
      // best-effort on platforms without POSIX modes
    }
  }

  list(): string[] {
    return Object.keys(this.read());
  }

  private read(): Record<string, string> {
    if (!existsSync(this.path)) return {};
    try {
      return JSON.parse(readFileSync(this.path, "utf8")) as Record<string, string>;
    } catch {
      return {};
    }
  }
}
