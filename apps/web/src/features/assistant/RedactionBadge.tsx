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
