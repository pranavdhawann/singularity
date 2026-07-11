import type { MemoryDto, MemoryMutationInput, MemoryNamespaceDto, MemoryRevisionDto } from "@future/core";
import { useEffect, useState } from "react";

export function MemoryInspector({ memory, namespaces, revisions, onSave, onDelete, onCompact }: {
  memory: MemoryDto | undefined; namespaces: MemoryNamespaceDto[]; revisions: MemoryRevisionDto[];
  onSave(input: MemoryMutationInput): Promise<void>; onDelete(): Promise<void>; onCompact(summary: string): Promise<void>;
}) {
  const [statement, setStatement] = useState("");
  const [reviewState, setReviewState] = useState<MemoryDto["reviewState"]>("proposed");
  const [pinned, setPinned] = useState(false);
  const [primaryNamespaceId, setPrimaryNamespaceId] = useState("");
  const [compactionSummary, setCompactionSummary] = useState("");
  useEffect(() => {
    if (!memory) return;
    setStatement(memory.statement); setReviewState(memory.reviewState); setPinned(memory.pinned);
    setPrimaryNamespaceId(memory.primaryNamespaceId ?? "");
    setCompactionSummary("");
  }, [memory]);

  if (!memory) return <aside className="inspector memory-inspector" aria-label="Memory inspector"><p>Select a memory to inspect it.</p></aside>;
  return (
    <aside className="inspector memory-inspector" aria-label="Memory inspector">
      <p className="eyebrow">Memory inspector</p><h2>Review memory</h2>
      <form onSubmit={(event) => { event.preventDefault(); void onSave({ expectedVersion: memory.version,
        statement, reviewState, pinned, namespaceIds: primaryNamespaceId ? [primaryNamespaceId] : [],
        primaryNamespaceId: primaryNamespaceId || null, reason: "user_edit" }); }}>
        <label>Memory statement<textarea aria-label="Memory statement" value={statement} onChange={(event) => setStatement(event.target.value)} /></label>
        <label>Status<select aria-label="Memory status" value={reviewState} onChange={(event) => setReviewState(event.target.value as MemoryDto["reviewState"])}>
          <option value="proposed">Proposed</option><option value="approved">Approved</option>
          <option value="rejected">Rejected</option><option value="outdated">Outdated</option>
        </select></label>
        <label className="checkbox-row"><input aria-label="Pinned" type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />Pinned</label>
        <label>Primary namespace<select aria-label="Primary namespace" value={primaryNamespaceId} onChange={(event) => setPrimaryNamespaceId(event.target.value)}>
          <option value="">Unassigned</option>{namespaces.map((namespace) => <option key={namespace.id} value={namespace.id}>{namespace.name}</option>)}
        </select></label>
        <div className="memory-actions"><button type="submit">Save memory</button>
          <button type="button" onClick={() => { if (window.confirm("Delete this memory?")) void onDelete(); }}>Delete memory</button></div>
      </form>
      <div className="inspector-group"><span>Provenance</span><p>{memory.sourceIds.length} linked sources</p>
        {memory.sourceIds.map((sourceId) => <code key={sourceId}>{sourceId}</code>)}
        <p>Confidence {memory.confidence}</p></div>
      <form className="compaction-form" onSubmit={(event) => { event.preventDefault();
        if (compactionSummary.trim()) void onCompact(compactionSummary.trim()).then(() => setCompactionSummary("")); }}>
        <label>Compaction summary<textarea aria-label="Compaction summary" value={compactionSummary}
          onChange={(event) => setCompactionSummary(event.target.value)} /></label>
        <button type="submit" disabled={!memory.contentHash}>Create compaction</button>
      </form>
      <div className="revision-list"><h3>Revision history</h3>
        {revisions.length === 0 ? <p>No revisions yet.</p> : revisions.map((revision) => <article key={revision.id}>
          <strong>Version {revision.version}</strong><p>{revision.reason}</p><small>{revision.createdAt}</small>
        </article>)}</div>
    </aside>
  );
}
