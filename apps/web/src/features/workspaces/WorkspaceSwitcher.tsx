import type { WorkspaceDto } from "@future/core";

export function WorkspaceSwitcher({ workspaces }: { workspaces: WorkspaceDto[] }) {
  return (
    <label className="workspace-switcher">
      <span>Workspace</span>
      <select defaultValue={workspaces[0]?.id}>
        {workspaces.map((workspace) => (
          <option value={workspace.id} key={workspace.id}>{workspace.name}</option>
        ))}
      </select>
    </label>
  );
}
