import type { ModelProfile, ProviderConfig, WorkspaceDto } from "@future/core";
import { useState } from "react";
import { AssistantComposer } from "../features/assistant/AssistantComposer";
import { ContextInspector } from "../features/assistant/ContextInspector";
import { useAssistantTurn } from "../features/assistant/use-assistant-turn";
import { CommandPalette } from "../features/command-palette/CommandPalette";
import { FirstRunSetup } from "../features/setup/FirstRunSetup";
import { TimelineView } from "../features/timeline/TimelineView";
import { MemoryWorkspace } from "../features/memory/MemoryWorkspace";
import { ImportWorkspace } from "../features/imports/ImportWorkspace";
import { ExternalPromptPreview } from "../features/prompt-preview/ExternalPromptPreview";
import { useTimeline } from "../features/timeline/use-timeline";
import { WorkspaceSwitcher } from "../features/workspaces/WorkspaceSwitcher";
import "../styles/global.css";
import { ApiClient } from "./api-client";
import type { FutureApi } from "./api-types";
import { useBootstrap } from "./use-bootstrap";

const navigationItems = ["Timeline", "Memory", "Imports", "Providers", "Permissions", "Settings"];
const defaultApi = new ApiClient();

export function App({ api = defaultApi }: { api?: FutureApi }) {
  const { state, reload } = useBootstrap(api);

  if (state.status === "loading") {
    return <main className="state-panel"><p>Connecting to the local Future service...</p></main>;
  }
  if (state.status === "error") {
    return (
      <main className="state-panel">
        <h1>Future is offline</h1>
        <p role="alert">{state.message}</p>
        <button type="button" onClick={reload}>Retry</button>
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

function ReadyAssistantShell({
  api,
  workspaces,
  providers,
  modelProfiles
}: {
  api: FutureApi;
  workspaces: WorkspaceDto[];
  providers: ProviderConfig[];
  modelProfiles: ModelProfile[];
}) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [selectedContextPackId, setSelectedContextPackId] = useState<string | undefined>(undefined);
  const [activeLens, setActiveLens] = useState<"timeline" | "memory" | "imports">("timeline");
  const activeProfile = modelProfiles[0];
  const timeline = useTimeline(api, activeWorkspaceId);
  const assistant = useAssistantTurn({
    api,
    onTimelineChanged: timeline.refresh,
    onContextSelected: setSelectedContextPackId
  });
  const composer = <AssistantComposer
    status={assistant.status}
    error={assistant.error}
    onSubmit={(message) => {
      if (!activeProfile) return;
      return assistant.submit({ workspaceId: activeWorkspaceId, modelProfileId: activeProfile.id, message });
    }}
    onCancel={assistant.cancel}
  />;

  return (
    <main className="app-shell">
      <aside className="left-rail" aria-label="Primary">
        <div className="brand-block">
          <span className="brand-mark">F</span>
          <div><strong>Future</strong><span>Continuous local assistant</span></div>
        </div>
        <nav className="nav-list">
          {navigationItems.map((item) => <button className="nav-item" type="button" key={item}
            aria-pressed={(item === "Memory" ? activeLens === "memory" : item === "Imports" ? activeLens === "imports" : item === "Timeline" ? activeLens === "timeline" : false)}
            onClick={() => { if (item === "Memory") setActiveLens("memory"); if (item === "Imports") setActiveLens("imports"); if (item === "Timeline") setActiveLens("timeline"); }}>{item}</button>)}
        </nav>
      </aside>
      <section className="workspace">
        <header className="top-bar">
          <WorkspaceSwitcher
            workspaces={workspaces}
            value={activeWorkspaceId}
            onChange={(workspaceId) => {
              setActiveWorkspaceId(workspaceId);
              setSelectedContextPackId(undefined);
            }}
          />
          <div className="top-status">
            <span>Model: {activeProfile?.name}</span>
            <span>Privacy: {activeProfile?.privacyPolicy === "local_only" ? "Local only" : "Prompt preview"}</span>
          </div>
        </header>
        <div className="content-grid">
          {activeLens === "memory" ? <MemoryWorkspace api={api} workspaceId={activeWorkspaceId} composer={composer} /> : activeLens === "imports" ? <ImportWorkspace api={api} workspaceId={activeWorkspaceId} /> : <>
          <section className="main-column">
            <CommandPalette />
            {timeline.error ? <p className="turn-error" role="alert">{timeline.error}</p> : null}
            <TimelineView
              events={timeline.events}
              streamedText={assistant.status === "streaming" ? assistant.streamedText : ""}
              onContextSelected={setSelectedContextPackId}
            />
            {composer}
          </section>
          <ContextInspector api={api} contextPackId={selectedContextPackId} />
          </>}
        </div>
        <footer className="activity-strip">
          <span>Jobs: idle</span>
          <span>Timeline: {timeline.events.length} events</span>
          <span>Provider: {providers[0]?.displayName}</span>
        </footer>
        {assistant.promptPreview ? <ExternalPromptPreview
          preview={assistant.promptPreview}
          onApprove={assistant.approvePrompt}
          onDeny={assistant.denyPrompt}
        /> : null}
      </section>
    </main>
  );
}
