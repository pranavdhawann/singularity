import { CommandPalette } from "../features/command-palette/CommandPalette";
import { TimelineView } from "../features/timeline/TimelineView";
import { WorkspaceSwitcher } from "../features/workspaces/WorkspaceSwitcher";
import "../styles/global.css";

const navigationItems = ["Timeline", "Memory", "Imports", "Providers", "Permissions", "Settings"];

export function App() {
  return (
    <main className="app-shell">
      <aside className="left-rail" aria-label="Primary">
        <div className="brand-block">
          <span className="brand-mark">F</span>
          <div>
            <strong>Future</strong>
            <span>Local assistant IDE</span>
          </div>
        </div>
        <nav className="nav-list">
          {navigationItems.map((item) => (
            <button className="nav-item" type="button" key={item}>
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="top-bar">
          <WorkspaceSwitcher />
          <div className="top-status">
            <span>Model: Mock</span>
            <span>Privacy: Prompt preview</span>
          </div>
        </header>

        <div className="content-grid">
          <section className="main-column">
            <CommandPalette />
            <TimelineView />
          </section>

          <aside className="inspector" aria-label="Inspector">
            <p className="eyebrow">Inspector</p>
            <h2>Memory</h2>
            <p>
              Proposed memories, source citations, permissions, and context packs will appear here
              as the local workflow runs.
            </p>
            <div className="inspector-group">
              <span>Permissions</span>
              <strong>External models ask every time</strong>
            </div>
            <div className="inspector-group">
              <span>Next approval</span>
              <strong>No pending requests</strong>
            </div>
          </aside>
        </div>

        <footer className="activity-strip">
          <span>Jobs: idle</span>
          <span>Timeline: 3 events</span>
          <span>Provider: mock ready</span>
        </footer>
      </section>
    </main>
  );
}
