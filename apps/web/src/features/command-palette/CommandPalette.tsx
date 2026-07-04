const commands = [
  "Ask with memory",
  "Search workspace",
  "Import files",
  "Review memories",
  "Prompt preview"
];

export function CommandPalette() {
  return (
    <section className="command-panel" aria-label="Command palette preview">
      <button className="command-trigger" type="button" aria-label="Command Palette">
        Command Palette
      </button>
      <div className="command-list">
        {commands.map((command) => (
          <button className="command-row" type="button" key={command}>
            {command}
          </button>
        ))}
      </div>
    </section>
  );
}
