import type {
  AssistantStreamFrame,
  AssistantTurnDto,
  ApiErrorResponse,
  ContextPackInspection,
  CreateMemoryInput,
  CreateNamespaceInput,
  CreateAssistantTurnInput,
  CreateModelProfileInput,
  CreateProviderInput,
  CreateWorkspaceInput,
  LocalSessionResponse,
  ModelProfile,
  MemoryDto,
  MemoryMutationInput,
  MemoryNamespaceDto,
  MemoryRevisionDto,
  ProviderConfig,
  TimelineEventDto,
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

  async createAssistantTurn(
    input: CreateAssistantTurnInput
  ): Promise<{ turn: AssistantTurnDto; replayed: boolean }> {
    return this.mutate<{ turn: AssistantTurnDto; replayed: boolean }>("/assistant-turns", input);
  }

  async *streamAssistantTurn(id: string): AsyncIterable<AssistantStreamFrame> {
    const token = await this.getSessionToken();
    const response = await fetch(`${this.baseUrl}/v2/assistant-turns/${encodeURIComponent(id)}/stream`, {
      method: "POST",
      headers: { "x-future-session": token }
    });
    if (!response.ok) throw await ApiClient.toError(response);
    if (!response.body) throw new Error("Assistant stream was unavailable");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const record = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const frame = parseSseRecord(record);
        if (frame) yield frame;
        boundary = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
    const finalFrame = parseSseRecord(buffer);
    if (finalFrame) yield finalFrame;
  }

  async cancelAssistantTurn(id: string): Promise<AssistantTurnDto> {
    return this.mutate<AssistantTurnDto>(`/assistant-turns/${encodeURIComponent(id)}/cancel`, null);
  }

  async listTimeline(
    workspaceId: string,
    after?: string
  ): Promise<{ events: TimelineEventDto[]; nextCursor?: string }> {
    const query = new URLSearchParams({ workspaceId });
    if (after) query.set("after", after);
    return this.get<{ events: TimelineEventDto[]; nextCursor?: string }>(`/timeline?${query}`);
  }

  async getContextPack(id: string): Promise<ContextPackInspection> {
    return this.get<ContextPackInspection>(`/context-packs/${encodeURIComponent(id)}`);
  }

  async listMemories(workspaceId: string, filters: { reviewState?: string; namespaceId?: string } = {}): Promise<{ items: MemoryDto[]; nextCursor?: string }> {
    const query = new URLSearchParams({ workspaceId });
    if (filters.reviewState) query.set("reviewState", filters.reviewState);
    if (filters.namespaceId) query.set("namespaceId", filters.namespaceId);
    return this.get(`/memories?${query}`);
  }

  async getMemory(id: string): Promise<MemoryDto> { return this.get(`/memories/${encodeURIComponent(id)}`); }
  async listMemoryRevisions(id: string): Promise<{ revisions: MemoryRevisionDto[] }> {
    return this.get(`/memories/${encodeURIComponent(id)}/revisions`);
  }
  async createMemory(input: CreateMemoryInput): Promise<MemoryDto> { return this.mutate("/memories", input); }
  async updateMemory(id: string, input: MemoryMutationInput): Promise<MemoryDto> {
    return this.mutate(`/memories/${encodeURIComponent(id)}`, input, "PATCH");
  }
  async deleteMemory(id: string, expectedVersion: number): Promise<MemoryDto> {
    return this.mutate(`/memories/${encodeURIComponent(id)}`, { expectedVersion }, "DELETE");
  }
  async listNamespaces(workspaceId: string): Promise<{ namespaces: MemoryNamespaceDto[] }> {
    return this.get(`/namespaces?workspaceId=${encodeURIComponent(workspaceId)}`);
  }
  async createNamespace(input: CreateNamespaceInput): Promise<MemoryNamespaceDto> {
    return this.mutate("/namespaces", input);
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

  private async mutate<T>(path: string, body: unknown, method: "POST" | "PATCH" | "DELETE" = "POST"): Promise<T> {
    const token = await this.getSessionToken();
    const response = await fetch(`${this.baseUrl}/v2${path}`, {
      method,
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

function parseSseRecord(record: string): AssistantStreamFrame | undefined {
  const data = record.split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  return data ? JSON.parse(data) as AssistantStreamFrame : undefined;
}
