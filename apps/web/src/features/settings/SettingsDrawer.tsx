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
