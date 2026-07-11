import type {
  AssistantStreamFrame,
  AssistantTurnDto,
  ContextPackInspection,
  CreateAssistantTurnInput,
  CreateModelProfileInput,
  CreateProviderInput,
  CreateWorkspaceInput,
  ModelProfile,
  ProviderConfig,
  TimelineEventDto,
  WorkspaceDto
} from "@future/core";

export type {
  AssistantStreamFrame,
  AssistantTurnDto,
  ContextPackInspection,
  CreateAssistantTurnInput,
  CreateModelProfileInput,
  CreateProviderInput,
  CreateWorkspaceInput,
  ModelProfile,
  ProviderConfig,
  TimelineEventDto,
  WorkspaceDto
} from "@future/core";

export interface FutureApi {
  listWorkspaces(): Promise<{ workspaces: WorkspaceDto[] }>;
  createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceDto>;
  listProviders(): Promise<{ providers: ProviderConfig[] }>;
  createProvider(input: CreateProviderInput): Promise<ProviderConfig>;
  listModelProfiles(providerId?: string): Promise<{ modelProfiles: ModelProfile[] }>;
  createModelProfile(input: CreateModelProfileInput): Promise<ModelProfile>;
  createAssistantTurn(input: CreateAssistantTurnInput): Promise<{ turn: AssistantTurnDto; replayed: boolean }>;
  streamAssistantTurn(id: string): AsyncIterable<AssistantStreamFrame>;
  cancelAssistantTurn(id: string): Promise<AssistantTurnDto>;
  listTimeline(workspaceId: string, after?: string): Promise<{ events: TimelineEventDto[]; nextCursor?: string }>;
  getContextPack(id: string): Promise<ContextPackInspection>;
}
