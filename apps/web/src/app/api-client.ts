import type {
  ApiErrorResponse,
  CreateModelProfileInput,
  CreateProviderInput,
  CreateWorkspaceInput,
  LocalSessionResponse,
  ModelProfile,
  ProviderConfig,
  WorkspaceDto
} from "@future/core";
import type { FutureApi } from "./api-types";

export interface ApiClientOptions {
  baseUrl?: string;
}

export class ApiClient implements FutureApi {
  private readonly baseUrl: string;
  private sessionToken?: string;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "/api";
  }

  async getHealth(): Promise<{ ok: boolean }> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed with ${response.status}`);
    }
    return (await response.json()) as { ok: boolean };
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceDto> {
    return this.mutate<WorkspaceDto>("/workspaces", input);
  }

  async listWorkspaces(): Promise<{ workspaces: WorkspaceDto[] }> {
    return this.get<{ workspaces: WorkspaceDto[] }>("/workspaces");
  }

  async listProviders(): Promise<{ providers: ProviderConfig[] }> {
    return this.get<{ providers: ProviderConfig[] }>("/providers");
  }

  async createProvider(input: CreateProviderInput): Promise<ProviderConfig> {
    return this.mutate<ProviderConfig>("/providers", input);
  }

  async listModelProfiles(providerId?: string): Promise<{ modelProfiles: ModelProfile[] }> {
    const query = providerId ? `?providerId=${encodeURIComponent(providerId)}` : "";
    return this.get<{ modelProfiles: ModelProfile[] }>(`/model-profiles${query}`);
  }

  async createModelProfile(input: CreateModelProfileInput): Promise<ModelProfile> {
    return this.mutate<ModelProfile>("/model-profiles", input);
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}/v2${path}`);
    if (!response.ok) {
      throw await ApiClient.toError(response);
    }
    return (await response.json()) as T;
  }

  private async getSessionToken(): Promise<string> {
    if (this.sessionToken) {
      return this.sessionToken;
    }

    const response = await fetch(`${this.baseUrl}/v2/session`);
    if (!response.ok) {
      throw await ApiClient.toError(response);
    }

    this.sessionToken = ((await response.json()) as LocalSessionResponse).token;
    return this.sessionToken;
  }

  private async mutate<T>(path: string, body: unknown): Promise<T> {
    const token = await this.getSessionToken();
    const response = await fetch(`${this.baseUrl}/v2${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-future-session": token
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw await ApiClient.toError(response);
    }

    return (await response.json()) as T;
  }

  private static async toError(response: Response): Promise<Error> {
    const body = (await response.json()) as Partial<ApiErrorResponse>;
    return new Error(body.error?.message ?? `Request failed with ${response.status}`);
  }
}
