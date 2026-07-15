import type { ReactNode } from "react";
import type { FutureApi } from "../../app/api-types";
import { ImportWorkspace } from "../imports/ImportWorkspace";
import { MemoryWorkspace } from "../memory/MemoryWorkspace";
import { PrivacyPanel } from "./PrivacyPanel";
import { ProvidersPanel } from "./ProvidersPanel";

export function buildSettingsPanels({
  api,
  workspaceId,
}: {
  api: FutureApi;
  workspaceId: string;
}): Record<string, ReactNode> {
  return {
    Providers: <ProvidersPanel api={api} />,
    Memory: <MemoryWorkspace api={api} workspaceId={workspaceId} />,
    Imports: <ImportWorkspace api={api} workspaceId={workspaceId} />,
    Privacy: <PrivacyPanel api={api} workspaceId={workspaceId} />,
  };
}
