const permissions = [
  ["Read files", "Ask every time"],
  ["Write memory", "Allow for workspace"],
  ["Use external models", "Ask every time"],
  ["Run commands", "Deny"],
];

export function PermissionsPanel() {
  return (
    <section className="permissions-panel" aria-label="Permissions panel">
      {permissions.map(([capability, state]) => (
        <div className="permission-row" key={capability}>
          <span>{capability}</span>
          <strong>{state}</strong>
        </div>
      ))}
    </section>
  );
}
