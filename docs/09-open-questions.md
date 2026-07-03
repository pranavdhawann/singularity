# Open Questions

These questions should be resolved before implementation begins.

## Product

- What is the final project name?
- Should the app launch as a browser-only local web app first, or use a desktop
  wrapper from day one?
- What is the first hero workflow for demos?
- Should the first public release target developers, power users, or both
  equally?

## Technical

- Should the first app use Tauri, Electron, or a plain local web server?
- Should the first backend be Node.js, Python, Rust, or a hybrid?
- Should vector search use sqlite-vec, LanceDB, Qdrant, or another local store?
- Should provider routing use an existing library or a small custom adapter?
- How much MCP support belongs in v1?

## Memory

- Which memories should require user review before promotion?
- How should conflicting memories be resolved?
- What is the default retention policy?
- How should compactions be regenerated after memory edits?

## Privacy

- Which PII types are blocked by default?
- Which sensitive data types can be replaced with local placeholders?
- Should external model calls show prompt previews by default?
- Should privacy-sensitive workspaces be local-model-only by default?

## Permissions

- What permissions should be denied by default?
- Which permissions can be granted per workspace?
- How should users review past grants?
- Should background tasks be allowed in v1?

## Open Source

- What license should be used long term?
- What contribution model should be documented first?
- Should the project publish an architecture RFC before code?
- Which integrations should be accepted into core versus plugins?
