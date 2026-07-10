export type ApiErrorCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "internal_error";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

export interface LocalSessionResponse {
  token: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  kind: string;
  privacyMode: "standard" | "local_only";
  rootPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceInput {
  name: string;
  kind?: string;
  privacyMode: "standard" | "local_only";
  rootPath?: string;
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      requestId,
      ...(details ? { details } : {})
    }
  };
}
