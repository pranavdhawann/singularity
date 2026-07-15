import { useEffect, useState } from "react";
import type { ProviderConfig } from "@future/core";
import type { FutureApi } from "../../app/api-types";

export function ProvidersPanel({ api }: { api: FutureApi }) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();
  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [saveMessage, setSaveMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    void api
      .listProviders()
      .then((result) => {
        if (!active) return;
        setProviders(result.providers);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Providers could not be loaded");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [api]);

  return (
    <section className="providers-panel" aria-label="Providers panel">
      <p className="eyebrow">Providers</p>
      <h2>Configured providers</h2>
      {status === "loading" ? <p>Loading providers...</p> : null}
      {status === "error" ? (
        <p role="alert" className="turn-error">
          {error}
        </p>
      ) : null}
      {status === "ready" && providers.length === 0 ? <p>No providers configured yet.</p> : null}
      <ul className="provider-list">
        {providers.map((provider) => (
          <li key={provider.id}>
            <strong>{provider.displayName}</strong>
            <span> · {provider.kind}</span>
            <span>{provider.isLocal ? " · local" : " · remote"}</span>
            <span>{provider.hasSecret ? " · key set" : " · no key"}</span>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!secretName.trim() || !secretValue) return;
          void api
            .setSecret(secretName.trim(), secretValue)
            .then(() => {
              setSaveMessage(`Saved ${secretName.trim()}.`);
              setSecretName("");
              setSecretValue("");
            })
            .catch((cause: unknown) => {
              setSaveMessage(cause instanceof Error ? cause.message : "Could not save secret");
            });
        }}
      >
        <label>
          Secret name
          <input
            aria-label="Secret name"
            value={secretName}
            onChange={(event) => setSecretName(event.target.value)}
            placeholder="OPENAI_API_KEY"
          />
        </label>
        <label>
          Secret value
          <input
            aria-label="Secret value"
            type="password"
            value={secretValue}
            onChange={(event) => setSecretValue(event.target.value)}
          />
        </label>
        <button type="submit">Save</button>
      </form>
      {saveMessage ? <p role="status">{saveMessage}</p> : null}
    </section>
  );
}
