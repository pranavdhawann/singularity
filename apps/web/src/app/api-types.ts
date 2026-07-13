import type {
  AssistantStreamFrame,
  AssistantTurnDto,
  ContextPackInspection,
  CreateCompactionInput,
  CreateMemoryInput,
  CreateNamespaceInput,
  CreateAssistantTurnInput,
  CreateModelProfileInput,
  CreateProviderInput,
  CreateWorkspaceInput,
  ModelProfile,
  ImportJobDto,
  MemoryDto,
  MemoryCompactionDto,
  MemoryMutationInput,
  MemoryNamespaceDto,
  MemoryRevisionDto,
  ProviderConfig,
  PromptDecisionDto,
  PromptPreviewDto,
  TimelineEventDto,
  WorkspaceDto,
} from "@future/core";

export type {
  AssistantStreamFrame,
  AssistantTurnDto,
  ContextPackInspection,
  CreateCompactionInput,
  CreateMemoryInput,
  CreateNamespaceInput,
  CreateAssistantTurnInput,
  CreateModelProfileInput,
  CreateProviderInput,
  CreateWorkspaceInput,
  ModelProfile,
  ImportJobDto,
  MemoryDto,
  MemoryCompactionDto,
  MemoryMutationInput,
  MemoryNamespaceDto,
  MemoryRevisionDto,
  ProviderConfig,
  PromptDecisionDto,
  PromptPreviewDto,
  TimelineEventDto,
  WorkspaceDto,
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
  listMemories(
    workspaceId: string,
    filters?: { reviewState?: string; namespaceId?: string },
  ): Promise<{ items: MemoryDto[]; nextCursor?: string }>;
  getMemory(id: string): Promise<MemoryDto>;
  listMemoryRevisions(id: string): Promise<{ revisions: MemoryRevisionDto[] }>;
  createMemory(input: CreateMemoryInput): Promise<MemoryDto>;
  updateMemory(id: string, input: MemoryMutationInput): Promise<MemoryDto>;
  deleteMemory(id: string, expectedVersion: number): Promise<MemoryDto>;
  listNamespaces(workspaceId: string): Promise<{ namespaces: MemoryNamespaceDto[] }>;
  createNamespace(input: CreateNamespaceInput): Promise<MemoryNamespaceDto>;
  createCompaction(input: CreateCompactionInput): Promise<MemoryCompactionDto>;
  uploadImports(workspaceId: string, files: File[]): Promise<ImportUploadResult>;
  listImports(workspaceId: string): Promise<{ jobs: ImportJobDto[] }>;
  getImport(id: string): Promise<ImportJobDto>;
  retryImport(id: string): Promise<{ job: ImportJobDto }>;
  getPromptPreview(id: string, workspaceId: string): Promise<PromptPreviewDto>;
  decidePromptPreview(
    id: string,
    workspaceId: string,
    decision: "approved" | "denied",
    bindingHash: string,
  ): Promise<PromptDecisionDto>;
}

export interface ImportUploadResult {
  files: Array<
    { filename: string; job: ImportJobDto } | { filename: string; errorCode: "unsupported_file" | "file_too_large" }
  >;
}
