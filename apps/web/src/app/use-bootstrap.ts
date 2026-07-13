import { useCallback, useEffect, useState } from "react";
import type { ModelProfile, ProviderConfig, WorkspaceDto } from "@future/core";
import type { FutureApi } from "./api-types";

export type BootstrapState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      workspaces: WorkspaceDto[];
      providers: ProviderConfig[];
      modelProfiles: ModelProfile[];
    };

export function useBootstrap(api: FutureApi) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<BootstrapState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });

    void Promise.all([api.listWorkspaces(), api.listProviders(), api.listModelProfiles()])
      .then(([workspaceResult, providerResult, profileResult]) => {
        if (!active) return;
        setState({
          status: "ready",
          workspaces: workspaceResult.workspaces,
          providers: providerResult.providers,
          modelProfiles: profileResult.modelProfiles,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to connect to the local API",
        });
      });

    return () => {
      active = false;
    };
  }, [api, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { state, reload };
}
