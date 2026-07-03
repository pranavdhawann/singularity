# Interface

Future should be a command center with a unified timeline. The interface should
feel closer to Raycast, Spotlight, an IDE side panel, and an activity log than a
traditional chat product.

## Primary Areas

### Command Palette

The command palette is the main entry point. Example commands:

- Ask with memory
- Search memory
- Search workspace
- Import chat export
- Import files
- Summarize project
- Plan task
- Draft response
- Remember this
- Forget selected memory
- Compact timeline
- Switch model
- Review permissions

### Timeline

The timeline stores all meaningful assistant history:

- user commands
- assistant responses
- imported conversations
- file and workspace imports
- memory extraction events
- compaction events
- permission grants and denials
- model calls
- action proposals
- action approvals
- action results

Timeline events should have source IDs and stable links so generated answers can
cite the exact memory, import, or event used.

### Memory Browser

The memory browser lets users inspect and control assistant memory.

Views:

- facts
- projects
- people
- preferences
- decisions
- tasks
- summaries
- uncertain memories
- recently used memories

Actions:

- edit
- delete
- pin
- merge
- split
- relabel
- mark as outdated
- show sources

### Workspace Panel

Workspaces group context by project or area of life.

Examples:

- a code repository
- a notes folder
- a startup idea
- a job search
- a research area
- personal admin

Each workspace can have its own indexed files, memories, permissions, preferred
models, and timeline filters.

### Provider Panel

Users can add API keys and local model endpoints.

Provider settings:

- provider name
- base URL
- API key or local endpoint
- default model
- context window
- cost notes
- local/cloud classification
- allowed workspaces
- prompt privacy policy

### Permissions Panel

Permissions should be detailed toggles, not only broad presets.

The UI should show:

- current permission state
- recent uses
- pending approval requests
- workspace overrides
- provider-specific restrictions
- memory and vault access rules

## No-Chat Principle

Future can support conversational turns, but it should not organize the product
around isolated chat threads. A user should feel like they are commanding and
maintaining an assistant, not managing tabs of conversations.

## First-Run Flow

1. Pick storage location.
2. Add one model provider or local endpoint.
3. Import one chat export or workspace folder.
4. Review extracted memories.
5. Run first command.
6. Inspect timeline and permissions.
