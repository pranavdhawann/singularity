import { useState, type FormEvent } from "react";
import type { ModelProfile, ProviderConfig, ProviderConnectionTestResult, WorkspaceDto } from "@future/core";
import type { FutureApi } from "../../app/api-types";

export interface FirstRunSetupProps {
  api: FutureApi;
  workspaces: WorkspaceDto[];
  providers: ProviderConfig[];
  modelProfiles: ModelProfile[];
  onComplete(): void;
}

export function FirstRunSetup({ api, workspaces, providers, modelProfiles, onComplete }: FirstRunSetupProps) {
  const [workspaceName, setWorkspaceName] = useState("Personal");
  const [privacyMode, setPrivacyMode] = useState<"standard" | "local_only">("standard");
  const [providerKind, setProviderKind] = useState<"mock" | "ollama" | "openai-compatible">("mock");
  const [providerName, setProviderName] = useState("Mock");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:11434");
  const [model, setModel] = useState("mock");
  const [secretEnvironmentVariable, setSecretEnvironmentVariable] = useState("FUTURE_OPENAI_API_KEY");
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ProviderConnectionTestResult>();
  const [testedFingerprint, setTestedFingerprint] = useState<string>();
  const [error, setError] = useState<string>();
  const connectionFingerprint = `${baseUrl}\n${secretEnvironmentVariable}`;

  function clearConnectionResult() {
    setConnectionResult(undefined);
    setTestedFingerprint(undefined);
  }

  async function testConnection(): Promise<boolean> {
    setTesting(true);
    setError(undefined);
    try {
      const result = await api.testProviderConnection({
        kind: "openai-compatible",
        baseUrl,
        secretEnvironmentVariable,
      });
      setConnectionResult(result);
      if (result.status === "ok") {
        setTestedFingerprint(connectionFingerprint);
        return true;
      }
      setTestedFingerprint(undefined);
      return false;
    } catch (caught) {
      clearConnectionResult();
      setError(caught instanceof Error ? caught.message : "Connection test failed");
      return false;
    } finally {
      setTesting(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);

    try {
      if (providerKind === "openai-compatible" && testedFingerprint !== connectionFingerprint) {
        const connected = await testConnection();
        if (!connected) return;
      }

      if (workspaces.length === 0) {
        await api.createWorkspace({ name: workspaceName, privacyMode });
      }

      const provider =
        providers[0] ??
        (await api.createProvider({
          kind: providerKind,
          displayName: providerName,
          ...(providerKind !== "mock" ? { baseUrl } : {}),
          ...(providerKind === "openai-compatible" ? { secretEnvironmentVariable } : {}),
          isLocal: providerKind !== "openai-compatible",
        }));

      if (modelProfiles.length === 0) {
        await api.createModelProfile({
          providerId: provider.id,
          name: "Default",
          model,
          contextWindow: providerKind === "mock" ? 4096 : 8192,
          purpose: "general",
          privacyPolicy: providerKind === "openai-compatible" ? "prompt_preview" : "local_only",
        });
      }

      onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Setup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="setup-panel" aria-labelledby="setup-heading">
      <p className="eyebrow">Local first run</p>
      <h1 id="setup-heading">Set up Singularity</h1>
      <p>Create the local workspace and model profile for your continuous assistant.</p>
      <form onSubmit={submit}>
        <label>
          Workspace name
          <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} required />
        </label>
        <label>
          Privacy
          <select value={privacyMode} onChange={(event) => setPrivacyMode(event.target.value as typeof privacyMode)}>
            <option value="standard">Standard</option>
            <option value="local_only">Local models only</option>
          </select>
        </label>
        <label>
          Provider
          <select
            value={providerKind}
            onChange={(event) => {
              const next = event.target.value as typeof providerKind;
              setProviderKind(next);
              clearConnectionResult();
              setProviderName(
                next === "mock" ? "Mock" : next === "ollama" ? "Local Ollama" : "External OpenAI-compatible",
              );
              setModel(next === "mock" ? "mock" : next === "ollama" ? "llama3.2" : "phase4-model");
              setBaseUrl(next === "openai-compatible" ? "http://127.0.0.1:4180/v1" : "http://127.0.0.1:11434");
            }}
          >
            <option value="mock">Mock (offline test)</option>
            <option value="ollama">Ollama</option>
            <option value="openai-compatible">OpenAI-compatible (external)</option>
          </select>
        </label>
        <label>
          Provider name
          <input value={providerName} onChange={(event) => setProviderName(event.target.value)} required />
        </label>
        {providerKind !== "mock" ? (
          <label>
            Base URL
            <input
              value={baseUrl}
              onChange={(event) => {
                setBaseUrl(event.target.value);
                clearConnectionResult();
              }}
              required
            />
          </label>
        ) : null}
        {providerKind === "openai-compatible" ? (
          <label>
            Secret environment variable
            <input
              value={secretEnvironmentVariable}
              onChange={(event) => {
                setSecretEnvironmentVariable(event.target.value);
                clearConnectionResult();
              }}
              required
            />
          </label>
        ) : null}
        {providerKind === "openai-compatible" ? (
          <div className="connection-test">
            <button type="button" disabled={testing || submitting} onClick={() => void testConnection()}>
              {testing ? "Testing..." : "Test connection"}
            </button>
            {connectionResult ? <p role="status">{connectionMessage(connectionResult)}</p> : null}
          </div>
        ) : null}
        <label>
          Model
          <input value={model} onChange={(event) => setModel(event.target.value)} required />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create local assistant"}
        </button>
      </form>
    </section>
  );
}

function connectionMessage(result: ProviderConnectionTestResult): string {
  if (result.status !== "ok") return result.message;
  return `Connected. ${result.models.length} model${result.models.length === 1 ? "" : "s"} available.`;
}
