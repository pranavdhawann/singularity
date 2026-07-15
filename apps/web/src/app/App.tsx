import type { ModelProfile, ProviderConfig, WorkspaceDto } from "@future/core";
import { useState } from "react";
import { AssistantComposer } from "../features/assistant/AssistantComposer";
import { ContextInspector } from "../features/assistant/ContextInspector";
import { useAssistantTurn } from "../features/assistant/use-assistant-turn";
import { CommandPalette } from "../features/command-palette/CommandPalette";
import { FirstRunSetup } from "../features/setup/FirstRunSetup";
import { TimelineView } from "../features/timeline/TimelineView";
import { ExternalPromptPreview } from "../features/prompt-preview/ExternalPromptPreview";
import { buildSettingsPanels } from "../features/settings/SettingsPanels";
import { SettingsDrawer } from "../features/settings/SettingsDrawer";
import { useTimeline } from "../features/timeline/use-timeline";
import "../styles/global.css";
import { ApiClient } from "./api-client";
import type { FutureApi } from "./api-types";
import { useBootstrap } from "./use-bootstrap";

const defaultApi = new ApiClient();

export function App({ api = defaultApi }: { api?: FutureApi }) {
  const { state, reload } = useBootstrap(api);

  if (state.status === "loading") {
    return (
      <main className="state-panel">
        <p>Connecting to the local Singularity service...</p>
      </main>
    );
  }
  if (state.status === "error") {
    return (
      <main className="state-panel">
        <h1>Singularity is offline</h1>
        <p role="alert">{state.message}</p>
        <button type="button" onClick={reload}>
          Retry
        </button>
      </main>
    );
  }
  const setupIncomplete =
    state.workspaces.length === 0 || state.providers.length === 0 || state.modelProfiles.length === 0;
  if (setupIncomplete) {
    return (
      <main className="setup-shell">
        <FirstRunSetup api={api} {...state} onComplete={reload} />
      </main>
    );
  }

  return <ReadyAssistantShell api={api} {...state} />;
}

export function ReadyAssistantShell({
  api,
  workspaces,
  providers,
  modelProfiles,
}: {
  api: FutureApi;
  workspaces: WorkspaceDto[];
  providers: ProviderConfig[];
  modelProfiles: ModelProfile[];
}) {
  const activeWorkspaceId = workspaces[0]?.id ?? "";
  const [activeProfileId, setActiveProfileId] = useState(modelProfiles[0]?.id ?? "");
  const [selectedContextPackId, setSelectedContextPackId] = useState<string | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeProfile = modelProfiles.find((profile) => profile.id === activeProfileId) ?? modelProfiles[0];
  const timeline = useTimeline(api, activeWorkspaceId);
  const assistant = useAssistantTurn({
    api,
    onTimelineChanged: timeline.refresh,
    onContextSelected: setSelectedContextPackId,
  });
  const composer = (
    <AssistantComposer
      status={assistant.status}
      error={assistant.error}
      onSubmit={(message) => {
        if (!activeProfile) return;
        return assistant.submit({ workspaceId: activeWorkspaceId, modelProfileId: activeProfile.id, message });
      }}
      onCancel={assistant.cancel}
    />
  );

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="top-bar">
          <div className="brand-block">
            <span className="brand-mark">S</span>
            <div>
              <strong>Singularity</strong>
              <span>Continuous local assistant</span>
            </div>
          </div>
          <div className="top-status">
            <label>
              Model profile
              <select
                aria-label="Model profile"
                value={activeProfile?.id ?? ""}
                onChange={(event) => setActiveProfileId(event.target.value)}
              >
                {modelProfiles.map((profile) => (
                  <option value={profile.id} key={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <span>Model: {activeProfile?.name}</span>
            <span>Privacy: {activeProfile?.privacyPolicy === "local_only" ? "Local only" : "Prompt preview"}</span>
            <button type="button" aria-label="Open settings" onClick={() => setSettingsOpen(true)}>
              ⚙
            </button>
          </div>
        </header>
        <div className="content-grid">
          <section className="main-column">
            <CommandPalette />
            {timeline.error ? (
              <p className="turn-error" role="alert">
                {timeline.error}
              </p>
            ) : null}
            <TimelineView
              events={timeline.events}
              streamedText={assistant.status === "streaming" ? assistant.streamedText : ""}
              onContextSelected={setSelectedContextPackId}
            />
            {composer}
          </section>
          <ContextInspector api={api} contextPackId={selectedContextPackId} />
        </div>
        <footer className="activity-strip">
          <span>Jobs: idle</span>
          <span>Timeline: {timeline.events.length} events</span>
          <span>Provider: {providers[0]?.displayName}</span>
        </footer>
        {assistant.promptPreview ? (
          <ExternalPromptPreview
            preview={assistant.promptPreview}
            onApprove={assistant.approvePrompt}
            onDeny={assistant.denyPrompt}
          />
        ) : null}
        {settingsOpen ? (
          <SettingsDrawer onClose={() => setSettingsOpen(false)}>
            {buildSettingsPanels({ api, workspaceId: activeWorkspaceId })}
          </SettingsDrawer>
        ) : null}
      </section>
    </main>
  );
}
