import type { WorkspaceDto } from "@future/core";

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceDto[];
  value?: string;
  onChange?(workspaceId: string): void;
}

export function WorkspaceSwitcher({ workspaces, value, onChange }: WorkspaceSwitcherProps) {
  return (
    <label className="workspace-switcher">
      <span>Workspace</span>
      <select
        value={value ?? workspaces[0]?.id ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {workspaces.map((workspace) => (
          <option value={workspace.id} key={workspace.id}>{workspace.name}</option>
        ))}
      </select>
    </label>
  );
}
