import type { ProviderConnectionTestResult, TestProviderConnectionInput } from "@future/core";

export interface ProviderConnectionServiceOptions {
  request?: typeof fetch;
  resolveSecret?: (name: string) => string | undefined;
  timeoutMs?: number;
}

const missingKeyResult = {
  status: "missing_key",
  message: "Set the configured environment variable and restart Singularity.",
} as const;

const unsupportedResult = {
  status: "unsupported",
  message: "The endpoint did not return an OpenAI-compatible model list.",
} as const;

export class ProviderConnectionService {
  private readonly request: typeof fetch;
  private readonly resolveSecret: (name: string) => string | undefined;
  private readonly timeoutMs: number;

  constructor(options: ProviderConnectionServiceOptions = {}) {
    this.request = options.request ?? fetch;
    this.resolveSecret = options.resolveSecret ?? ((name) => process.env[name]);
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async test(input: TestProviderConnectionInput): Promise<ProviderConnectionTestResult> {
    const apiKey = this.resolveSecret(input.secretEnvironmentVariable);
    if (!apiKey) return missingKeyResult;

    const url = modelsUrl(input.baseUrl);
    if (!url) {
      return { status: "unreachable", message: "Enter a valid HTTP or HTTPS provider base URL." };
    }

    let response: Response;
    try {
      response = await this.request(url, {
        method: "GET",
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      return { status: "unreachable", message: "Singularity could not reach the provider endpoint." };
    }

    if (response.status === 401 || response.status === 403) return missingKeyResult;
    if (!response.ok) return unsupportedResult;

    try {
      const models = readModelIds(await response.json());
      return models ? { status: "ok", models } : unsupportedResult;
    } catch {
      return unsupportedResult;
    }
  }
}

function modelsUrl(baseUrl: string): string | undefined {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return `${url.toString().replace(/\/$/, "")}/models`;
  } catch {
    return undefined;
  }
}

function readModelIds(value: unknown): string[] | undefined {
  if (!isRecord(value) || !Array.isArray(value.data) || value.data.length === 0) return undefined;
  const ids = value.data.map((model) => (isRecord(model) && typeof model.id === "string" ? model.id.trim() : ""));
  if (ids.some((id) => id.length === 0)) return undefined;
  return [...new Set(ids)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
