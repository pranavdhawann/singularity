import { useEffect, useState } from "react";
import type { FutureApi, WorkspaceSettings } from "../../app/api-types";

export function PrivacyPanel({ api, workspaceId }: { api: FutureApi; workspaceId: string }) {
  const [settings, setSettings] = useState<WorkspaceSettings>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void api
      .getSettings(workspaceId)
      .then((result) => {
        if (!active) return;
        setSettings(result);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Settings could not be loaded");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [api, workspaceId]);

  const toggle = (key: "redactLocalToo" | "autoCapture") => {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    void api
      .updateSettings({ workspaceId, [key]: next[key] })
      .then((result) => setSettings(result))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Setting could not be saved");
      });
  };

  return (
    <section className="privacy-panel" aria-label="Privacy panel">
      <p className="eyebrow">Privacy</p>
      <h2>Privacy</h2>
      {status === "loading" ? <p>Loading settings...</p> : null}
      {status === "error" ? (
        <p role="alert" className="turn-error">
          {error}
        </p>
      ) : null}
      {settings ? (
        <div className="privacy-toggles">
          <label>
            <input
              aria-label="Redact local models too"
              type="checkbox"
              checked={settings.redactLocalToo}
              onChange={() => toggle("redactLocalToo")}
            />
            Redact local models too
          </label>
          <label>
            <input
              aria-label="Auto-capture memory"
              type="checkbox"
              checked={settings.autoCapture}
              onChange={() => toggle("autoCapture")}
            />
            Auto-capture memory
          </label>
        </div>
      ) : null}
    </section>
  );
}
