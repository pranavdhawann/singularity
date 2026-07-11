import type { MemoryDto, MemoryRevisionDto } from "@future/core";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { FutureApi } from "../../app/api-types";
import { MemoryInspector } from "./MemoryInspector";
import { useMemories } from "./use-memories";

export function MemoryWorkspace({ api, workspaceId, composer }: { api: FutureApi; workspaceId: string; composer?: ReactNode }) {
  const state = useMemories(api, workspaceId);
  const [selectedId, setSelectedId] = useState<string>();
  const [selected, setSelected] = useState<MemoryDto>();
  const [revisions, setRevisions] = useState<MemoryRevisionDto[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [newNamespace, setNewNamespace] = useState("");
  const [actionError, setActionError] = useState<string>();

  const loadSelected = async (id: string) => {
    try {
      const [memory, history] = await Promise.all([api.getMemory(id), api.listMemoryRevisions(id)]);
      setSelected(memory); setRevisions(history.revisions); setActionError(undefined);
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Memory could not be loaded"); }
  };
  useEffect(() => { setSelectedId(undefined); setSelected(undefined); setRevisions([]); }, [workspaceId]);
  useEffect(() => { if (selectedId) void loadSelected(selectedId); }, [selectedId]);

  const run = async (action: () => Promise<unknown>) => {
    try { await action(); setActionError(undefined); if (selectedId) await loadSelected(selectedId); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Memory action failed"); }
  };

  return <>
    <section className="main-column memory-workspace" aria-label="Memory workspace">
      <section className="memory-toolbar">
        <div><p className="eyebrow">Memory</p><h2>Memory workspace</h2><p>Review queue: {state.memories.filter((memory) => memory.reviewState === "proposed").length}</p></div>
        <label>Status filter<select aria-label="Memory status filter" value={state.reviewState} onChange={(event) => state.setReviewState(event.target.value)}>
          <option value="">All active</option><option value="proposed">Proposed</option><option value="approved">Approved</option>
          <option value="outdated">Outdated</option><option value="rejected">Rejected</option>
        </select></label>
      </section>
      <div className="namespace-list" aria-label="Memory namespaces">
        <button type="button" className={!state.namespaceId ? "selected" : ""} onClick={() => state.setNamespaceId("")}>All memory</button>
        {state.namespaces.map((namespace) => <button type="button" key={namespace.id}
          className={state.namespaceId === namespace.id ? "selected" : ""} onClick={() => state.setNamespaceId(namespace.id)}>{namespace.name}</button>)}
      </div>
      <div className="memory-create-row">
        <form onSubmit={(event) => { event.preventDefault(); if (!newMemory.trim()) return; void run(async () => {
          const created = await state.create(newMemory.trim()); setNewMemory(""); setSelectedId(created.id); }); }}>
          <label>New memory<input aria-label="New memory" value={newMemory} onChange={(event) => setNewMemory(event.target.value)} /></label>
          <button type="submit">Add for review</button>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); if (!newNamespace.trim()) return; void run(async () => {
          await state.createNamespace(newNamespace.trim()); setNewNamespace(""); }); }}>
          <label>New namespace<input aria-label="New namespace" value={newNamespace} onChange={(event) => setNewNamespace(event.target.value)} /></label>
          <button type="submit">Create namespace</button>
        </form>
      </div>
      {state.status === "loading" ? <p>Loading memory...</p> : null}
      {state.error || actionError ? <p role="alert" className="turn-error">{state.error ?? actionError}</p> : null}
      <div className="memory-list">
        {state.status === "ready" && state.memories.length === 0 ? <p>No memory matches this view.</p> : null}
        {state.memories.map((memory) => <button type="button" className="memory-card" key={memory.id}
          aria-label={memory.statement} onClick={() => setSelectedId(memory.id)}>
          <span>{memory.reviewState}{memory.pinned ? " · pinned" : ""}</span><strong>{memory.statement}</strong>
          <small>Version {memory.version} · confidence {memory.confidence}</small>
        </button>)}
      </div>
      {composer}
    </section>
    <MemoryInspector memory={selected} namespaces={state.namespaces} revisions={revisions}
      onSave={async (input) => { if (!selected) return; await run(async () => { const next = await state.update(selected.id, input); setSelected(next); }); }}
      onDelete={async () => { if (!selected) return; await run(async () => { await state.remove(selected.id, selected.version);
        setSelectedId(undefined); setSelected(undefined); setRevisions([]); }); }}
      onCompact={async (summary) => { if (!selected?.contentHash) return; await run(async () => {
        await api.createCompaction({ workspaceId, summary,
          sources: [{ kind: "memory", id: selected.id, contentHash: selected.contentHash! }] }); }); }} />
  </>;
}
