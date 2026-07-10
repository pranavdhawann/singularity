import type {
  CreateModelProfileInput,
  CreateProviderInput,
  CreateWorkspaceInput,
  ModelProfile,
  ProviderConfig,
  WorkspaceDto
} from "@future/core";

export type {
  CreateModelProfileInput,
  CreateProviderInput,
  CreateWorkspaceInput,
  ModelProfile,
  ProviderConfig,
  WorkspaceDto
} from "@future/core";

export interface FutureApi {
  listWorkspaces(): Promise<{ workspaces: WorkspaceDto[] }>;
  createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceDto>;
  listProviders(): Promise<{ providers: ProviderConfig[] }>;
  createProvider(input: CreateProviderInput): Promise<ProviderConfig>;
  listModelProfiles(providerId?: string): Promise<{ modelProfiles: ModelProfile[] }>;
  createModelProfile(input: CreateModelProfileInput): Promise<ModelProfile>;
}
