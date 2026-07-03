# V1 Scope

V1 should prove the central product loop:

1. Import or index useful context.
2. Build inspectable memory.
3. Retrieve relevant context for a task.
4. Route the task to the selected model.
5. Show the result and timeline record.
6. Respect detailed permissions.

## In Scope

### Local Command Center

- Local web app launched from the user's machine.
- Command palette for ask, search, import, summarize, plan, draft, index, and
  remember actions.
- Panels for timeline, memory, workspaces, providers, and permissions.

### Unified Timeline

- One chronological event stream for commands, imports, conversations, memory
  updates, compactions, decisions, and action results.
- Filter by workspace, source, model, action type, label, date, and confidence.
- Every generated answer should create a timeline event.

### Memory Layer

- Raw event log.
- Rolling compactions.
- Extracted facts.
- Episodic memories.
- Procedural preferences.
- Labels and source links.
- Editable and deletable memories.

### Imports

- ChatGPT exports.
- Claude exports if available in a usable format.
- Markdown.
- Plain text.
- PDFs.
- Project folders and repos.

### Model Providers

- Bring-your-own API keys.
- OpenAI-compatible provider abstraction.
- OpenAI, Anthropic, Google, OpenRouter, Ollama, and LM Studio as initial
  targets.
- Per-task provider/model selection.

### Permissions

Detailed toggles for:

- read files
- write files
- run commands
- browse web
- call APIs
- access contacts
- call people
- access vault
- write memory
- use external models
- install or connect tools
- run background tasks

Each permission should support deny, ask every time, allow for session, allow
for workspace, and always allow.

### Actions

V1 actions can include:

- answer questions
- summarize
- plan
- draft
- search memory
- search workspace
- create or update memories
- propose file changes
- optionally apply file changes after approval
- optionally run commands after approval

## Out of Scope

- hosted model billing
- multi-user teams
- mobile app
- marketplace
- phone calls
- email and calendar connectors
- Slack, Discord, Telegram, and WhatsApp connectors
- always-on autonomous agents
- cloud sync

## V1 Success Criteria

Future v1 is successful if a user can:

- import old chats and project files
- inspect what the assistant remembered
- correct or delete bad memory
- ask a new question and get source-backed context
- see every action in the timeline
- connect at least two model providers
- control permissions before the assistant acts
