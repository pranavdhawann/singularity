export function WorkspaceSwitcher() {
  return (
    <label className="workspace-switcher">
      <span>Workspace</span>
      <select defaultValue="future">
        <option value="future">Future Demo</option>
      </select>
    </label>
  );
}
