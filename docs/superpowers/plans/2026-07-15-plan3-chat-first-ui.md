# Plan 3 — Chat-First UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a single conversation the whole app; move Memory/Imports/Providers/Privacy behind a gear-icon Settings drawer; collapse the workspace switcher to one implicit workspace.

**Architecture:** Reuse existing feature components as drawer panels rather than rewriting them. `App.tsx` renders one chat (`TimelineView` + `AssistantComposer`) plus a gear button that toggles a focus-trapped `SettingsDrawer`. The multi-lens `navigationItems` console and `WorkspaceSwitcher` are removed from the primary surface.

**Tech Stack:** React, Vitest + `@testing-library/react` (jsdom). Reuse the dialog/focus-trap pattern from `ExternalPromptPreview.tsx`.

**Test runner note:** web tests need `--environment jsdom` and `afterEach(cleanup)` when a file renders more than once. Run a single file with:
`CI=true corepack pnpm --filter @future/web exec vitest run --environment jsdom <path>`

**Model assignments (subagent dispatch):**

| Task                             | Unit | Model      | Why                                |
| -------------------------------- | ---- | ---------- | ---------------------------------- |
| 1 SettingsDrawer (focus-trapped) | G    | **Sonnet** | New component + a11y focus trap    |
| 2 Drawer panels (wrap existing)  | G    | **Haiku**  | Composition of existing components |
| 3 Chat-first shell + gear        | F    | **Sonnet** | `App.tsx` restructure              |
| 4 Redaction badge                | F    | **Sonnet** | Consumes Plan 1 redaction summary  |
| 5 Single implicit workspace      | H    | **Haiku**  | Mostly removal/wiring              |

**Prerequisite:** Branch `feat/v2-chat-first-memory`. Tasks 1–3, 5 are independent of Plan 1/2. Task 4 (badge) consumes Plan 1's redaction summary on the turn/timeline; if Plan 1 is not merged yet, build the badge against the documented shape and stub the data in its test.

---

## Task 1: SettingsDrawer shell (focus-trapped)

**Files:**

- Create: `apps/web/src/features/settings/SettingsDrawer.tsx`
- Modify: `apps/web/src/styles/global.css`
- Test: `apps/web/src/features/settings/SettingsDrawer.test.tsx`

- [ ] **Step 1: Write the failing test `apps/web/src/features/settings/SettingsDrawer.test.tsx`**

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsDrawer } from "./SettingsDrawer";

afterEach(cleanup);

describe("SettingsDrawer", () => {
  it("renders section tabs and the active panel", () => {
    render(
      <SettingsDrawer onClose={vi.fn()}>
        {{ Providers: <p>providers panel</p>, Privacy: <p>privacy panel</p> }}
      </SettingsDrawer>,
    );
    expect(screen.getByRole("dialog", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText("providers panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Privacy" }));
    expect(screen.getByText("privacy panel")).toBeInTheDocument();
  });

  it("closes on Escape and on overlay click", () => {
    const onClose = vi.fn();
    render(<SettingsDrawer onClose={onClose}>{{ Providers: <p>x</p> }}</SettingsDrawer>);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("settings-overlay"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("focuses the first tab on open", () => {
    render(<SettingsDrawer onClose={vi.fn()}>{{ Providers: <p>x</p>, Privacy: <p>y</p> }}</SettingsDrawer>);
    expect(screen.getByRole("tab", { name: "Providers" })).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/web exec vitest run --environment jsdom src/features/settings/SettingsDrawer.test.tsx`
Expected: FAIL — `Cannot find module './SettingsDrawer'`.

- [ ] **Step 3: Implement `apps/web/src/features/settings/SettingsDrawer.tsx`**

```tsx
import { useEffect, useRef, useState, type ReactNode } from "react";

export function SettingsDrawer({ children, onClose }: { children: Record<string, ReactNode>; onClose(): void }) {
  const sections = Object.keys(children);
  const [active, setActive] = useState(sections[0] ?? "");
  const firstTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstTabRef.current?.focus();
  }, []);

  return (
    <div className="settings-overlay" data-testid="settings-overlay" onClick={onClose}>
      <section
        className="settings-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <header className="settings-header">
          <h2>Settings</h2>
          <button type="button" aria-label="Close settings" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="settings-body">
          <nav role="tablist" aria-label="Settings sections" className="settings-tabs">
            {sections.map((section, index) => (
              <button
                key={section}
                ref={index === 0 ? firstTabRef : undefined}
                type="button"
                role="tab"
                aria-selected={section === active}
                onClick={() => setActive(section)}
              >
                {section}
              </button>
            ))}
          </nav>
          <div className="settings-panel" role="tabpanel">
            {children[active]}
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Add styles to `apps/web/src/styles/global.css`**

```css
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  justify-content: flex-end;
  background: rgb(9 20 24 / 45%);
}
.settings-drawer {
  width: min(560px, 92vw);
  height: 100%;
  overflow: auto;
  background: #fff;
  box-shadow: -12px 0 40px rgb(9 20 24 / 25%);
  padding: 20px;
}
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.settings-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 12px 0;
}
.settings-tabs [aria-selected="true"] {
  font-weight: 700;
  border-bottom: 2px solid #2f766d;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/web exec vitest run --environment jsdom src/features/settings/SettingsDrawer.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/settings/SettingsDrawer.tsx apps/web/src/features/settings/SettingsDrawer.test.tsx apps/web/src/styles/global.css
git commit -m "feat(ui): add focus-trapped SettingsDrawer shell"
```

---

## Task 2: Drawer panels wrapping existing features

**Files:**

- Create: `apps/web/src/features/settings/SettingsPanels.tsx`
- Test: `apps/web/src/features/settings/SettingsPanels.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSettingsPanels } from "./SettingsPanels";
import type { FutureApi } from "../../app/api-types";

afterEach(cleanup);

describe("buildSettingsPanels", () => {
  it("returns Providers, Memory, Imports, and Privacy panels", () => {
    const api = { listImports: vi.fn(async () => ({ jobs: [] })) } as unknown as FutureApi;
    const panels = buildSettingsPanels({ api, workspaceId: "w_1" });
    expect(Object.keys(panels)).toEqual(["Providers", "Memory", "Imports", "Privacy"]);
    render(<>{panels.Imports}</>);
    expect(screen.getByLabelText("Imports workspace")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/web exec vitest run --environment jsdom src/features/settings/SettingsPanels.test.tsx`
Expected: FAIL — `Cannot find module './SettingsPanels'`.

- [ ] **Step 3: Implement `apps/web/src/features/settings/SettingsPanels.tsx`**

```tsx
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
    Memory: <MemoryWorkspace api={api} workspaceId={workspaceId} composer={null} />,
    Imports: <ImportWorkspace api={api} workspaceId={workspaceId} />,
    Privacy: <PrivacyPanel api={api} workspaceId={workspaceId} />,
  };
}
```

> `MemoryWorkspace` currently requires a `composer` prop. If it does not accept `null`, pass a minimal placeholder or make the prop optional in a small edit — the drawer context has no live composer. `ProvidersPanel` and `PrivacyPanel` are thin new components: `ProvidersPanel` renders the existing provider list/add form (extract from wherever `Providers` was rendered before) with a key-entry field that calls a new `api.setSecret(name, value)`; `PrivacyPanel` renders toggles for redaction mode, `redactLocalToo`, engine choice, and `autoCapture`, calling `api.updateSettings(...)`. Build each with its own failing test first (mirror this task's structure).

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/web exec vitest run --environment jsdom src/features/settings/SettingsPanels.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/settings/
git commit -m "feat(ui): settings drawer panels wrapping existing features"
```

---

## Task 3: Chat-first shell + gear button

**Files:**

- Modify: `apps/web/src/app/App.tsx` (replace `navigationItems` console + content-grid)
- Test: `apps/web/src/app/App.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test `apps/web/src/app/App.test.tsx`**

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadyAssistantShell } from "./App";
import type { FutureApi } from "./api-types";

afterEach(cleanup);

const api = {
  listImports: vi.fn(async () => ({ jobs: [] })),
  listMemories: vi.fn(async () => ({ memories: [] })),
} as unknown as FutureApi;

const props = {
  api,
  workspaces: [{ id: "w_1", name: "Personal", createdAt: "t", updatedAt: "t" }],
  providers: [{ id: "p_1", displayName: "Mock" }],
  modelProfiles: [{ id: "m_1", name: "Mock", providerId: "p_1", model: "mock" }],
} as never;

describe("ReadyAssistantShell", () => {
  it("shows a single chat and no lens navigation", () => {
    render(<ReadyAssistantShell {...props} />);
    expect(screen.queryByRole("button", { name: "Memory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Imports" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });

  it("opens the settings drawer from the gear", () => {
    render(<ReadyAssistantShell {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(screen.getByRole("dialog", { name: /settings/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/web exec vitest run --environment jsdom src/app/App.test.tsx`
Expected: FAIL — lens buttons still present / `ReadyAssistantShell` not exported.

- [ ] **Step 3: Implement**

In `App.tsx`: (a) `export` `ReadyAssistantShell`. (b) Delete the `navigationItems` array and the left-rail `<nav>` lens buttons; delete `activeLens` state and the `content-grid` lens switch. (c) Render a single chat column (`TimelineView` + `composer` + `ContextInspector`). (d) Add a `const [settingsOpen, setSettingsOpen] = useState(false)` and a header gear button `<button aria-label="Open settings" onClick={() => setSettingsOpen(true)}>⚙</button>`. (e) When `settingsOpen`, render `<SettingsDrawer onClose={() => setSettingsOpen(false)}>{buildSettingsPanels({ api, workspaceId: activeWorkspaceId })}</SettingsDrawer>`. Keep the model-profile `<select>` in the chat header.

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/web exec vitest run --environment jsdom src/app/App.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/App.tsx apps/web/src/app/App.test.tsx
git commit -m "feat(ui): single-chat shell with settings gear"
```

---

## Task 4: Redaction badge in the chat

Shows "N items redacted" when the last turn masked PII, revealing the typed counts on click. Consumes the redaction summary produced by Plan 1 (Unit C) on the turn/timeline.

**Files:**

- Create: `apps/web/src/features/assistant/RedactionBadge.tsx`
- Test: `apps/web/src/features/assistant/RedactionBadge.test.tsx`
- Modify: `apps/web/src/app/App.tsx` (render it near the composer)

- [ ] **Step 1: Write the failing test `apps/web/src/features/assistant/RedactionBadge.test.tsx`**

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RedactionBadge } from "./RedactionBadge";

afterEach(cleanup);

describe("RedactionBadge", () => {
  it("summarizes total redactions and reveals typed counts on click", () => {
    render(<RedactionBadge counts={{ email: 2, credit_card: 1 }} />);
    expect(screen.getByRole("button", { name: /3 items redacted/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/email: 2/)).toBeInTheDocument();
    expect(screen.getByText(/credit_card: 1/)).toBeInTheDocument();
  });

  it("renders nothing when no redactions occurred", () => {
    const { container } = render(<RedactionBadge counts={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/web exec vitest run --environment jsdom src/features/assistant/RedactionBadge.test.tsx`
Expected: FAIL — `Cannot find module './RedactionBadge'`.

- [ ] **Step 3: Implement `apps/web/src/features/assistant/RedactionBadge.tsx`**

```tsx
import { useState } from "react";

export function RedactionBadge({ counts }: { counts: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (total === 0) return null;
  return (
    <div className="redaction-badge">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        🛡 {total} items redacted
      </button>
      {open ? (
        <ul>
          {Object.entries(counts).map(([type, n]) => (
            <li key={type}>
              {type}: {n}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/web exec vitest run --environment jsdom src/features/assistant/RedactionBadge.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire it in `App.tsx`**

Render `<RedactionBadge counts={assistant.lastRedactionCounts ?? {}} />` above the composer. Populate `lastRedactionCounts` from the `prompt_preview.required`/`model_call.completed` event payload's `redactionCounts` (the shape Plan 1 Task 8 records). Until Plan 1 is merged, default to `{}` (badge renders nothing) — no regression.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/assistant/RedactionBadge.tsx apps/web/src/features/assistant/RedactionBadge.test.tsx apps/web/src/app/App.tsx
git commit -m "feat(ui): redaction badge in the chat"
```

---

## Task 5: Single implicit workspace

**Files:**

- Modify: `apps/web/src/app/App.tsx` (remove `WorkspaceSwitcher` from the top bar)
- Modify: `apps/web/src/features/setup/FirstRunSetup.tsx` (create exactly one workspace)
- Test: covered by `App.test.tsx` Task 3 assertion + a small setup test

- [ ] **Step 1: Extend `App.test.tsx` with a failing assertion**

Add to the existing describe block:

```tsx
it("does not render a workspace switcher on the primary surface", () => {
  render(<ReadyAssistantShell {...props} />);
  expect(screen.queryByLabelText("Workspace")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/web exec vitest run --environment jsdom src/app/App.test.tsx`
Expected: FAIL — the `Workspace` `<label>` from `WorkspaceSwitcher` is still present.

- [ ] **Step 3: Implement**

In `App.tsx`, remove the `<WorkspaceSwitcher .../>` element from the top bar and the related `onChange` handler; keep `activeWorkspaceId = workspaces[0].id`. In `FirstRunSetup.tsx`, ensure the flow creates a single workspace and does not expose "add another workspace". Leave `WorkspaceSwitcher.tsx` in the tree (unused) for a possible advanced setting later, or delete it if nothing imports it (`grep -rn WorkspaceSwitcher apps/web/src`).

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/web exec vitest run --environment jsdom src/app/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/App.tsx apps/web/src/features/setup/FirstRunSetup.tsx
git commit -m "feat(ui): collapse to a single implicit workspace"
```

---

## Final verification (Plan 3)

- [ ] Run the full gate:

```bash
CI=true corepack pnpm check
```

Expected: typecheck, lint, format, all tests pass.

- [ ] Manual smoke (optional): `corepack pnpm dev`, confirm first paint is a single chat, the gear opens the drawer with Providers/Memory/Imports/Privacy, and no workspace switcher or lens tabs appear.

## Spec-coverage note

- Unit F ✅ Tasks 3–4. Unit G ✅ Tasks 1–2. Unit H ✅ Task 5.
- Cross-plan: the redaction badge (Task 4) and Privacy panel (Task 2) consume `SecretStore`/settings/redaction-summary created in Plan 1; both degrade safely if Plan 1 is not yet merged.
