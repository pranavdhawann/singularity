import { CommandPalette } from "../features/command-palette/CommandPalette";
import { FirstRunSetup } from "../features/setup/FirstRunSetup";
import { TimelineView } from "../features/timeline/TimelineView";
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

  const activeProfile = state.modelProfiles[0];

  return (
    <main className="app-shell">
      <aside className="left-rail" aria-label="Primary">
        <div className="brand-block"><span className="brand-mark">F</span><div><strong>Future</strong><span>Continuous local assistant</span></div></div>
        <nav className="nav-list">{navigationItems.map((item) => <button className="nav-item" type="button" key={item}>{item}</button>)}</nav>
      </aside>
      <section className="workspace">
        <header className="top-bar">
          <WorkspaceSwitcher workspaces={state.workspaces} />
          <div className="top-status"><span>Model: {activeProfile?.name}</span><span>Privacy: {activeProfile?.privacyPolicy === "local_only" ? "Local only" : "Prompt preview"}</span></div>
        </header>
        <div className="content-grid">
          <section className="main-column"><CommandPalette /><TimelineView /></section>
          <aside className="inspector" aria-label="Inspector"><p className="eyebrow">Inspector</p><h2>Context</h2><p>Sources, memories, and approvals will appear here when assistant turns are connected.</p></aside>
        </div>
        <footer className="activity-strip"><span>Jobs: idle</span><span>Timeline: empty</span><span>Provider: {state.providers[0]?.displayName}</span></footer>
      </section>
    </main>
  );
}
