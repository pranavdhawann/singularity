# Memory-First Assistant IDE Design

Date: 2026-07-03

## Summary

Future is a local, model-agnostic assistant IDE for power users and developers.
It uses a command center and unified timeline instead of a traditional chat-first
interface. The product focuses on durable memory, source-backed retrieval,
explicit permissions, and bring-your-own model providers.

## Problem

Users lose context across assistant sessions, model providers, chat exports,
project folders, and personal workflows. They repeatedly re-explain goals,
constraints, preferences, decisions, and project state. Existing tools solve
parts of this problem, but many are either chat-first, coding-first, or API-first
rather than memory-first.

## Design Direction

Build a local command center with:

- command palette as the primary interaction model
- unified timeline for all conversations, imports, memory updates, actions, and
  decisions
- memory browser for inspecting, editing, deleting, pinning, and relabeling
  memories
- workspace panels for projects, repos, docs, and personal contexts
- provider panel for BYO model keys and local endpoints
- detailed permission toggles for every meaningful capability

## Architecture

### Local App Shell

V1 should start as a local web app launched from the user's machine. A Tauri or
Electron wrapper can be added later if the project needs tray integration,
native menus, auto-update, or secure desktop APIs.

### Event Store

The raw event log is the source of truth. It stores commands, responses,
imports, model calls, permission changes, memory jobs, compactions, action
proposals, approvals, denials, and results.

### Memory System

The memory system has layered records:

- raw events
- compaction ledger
- fact memory
- episodic memory
- procedural memory
- source-backed retrieval context

Every memory should include source IDs, confidence, scope, privacy labels, and
review state.

### Retrieval

The retrieval planner builds a context pack for each model call:

- active workspace summary
- recent timeline
- relevant facts
- relevant episodes
- procedural preferences
- raw snippets
- pinned memories
- permission state

The context pack should adapt to the selected model's context window.

### Model Routing

V1 supports bring-your-own API keys and local endpoints:

- OpenAI
- Anthropic
- Google
- OpenRouter
- Ollama
- LM Studio
- OpenAI-compatible endpoints

Provider use should be recorded in the timeline.

### Privacy Pipeline

Before external model calls, Future should:

1. build a candidate context pack
2. classify sensitive data
3. apply redaction policy
4. optionally show prompt preview
5. send approved context
6. store call metadata

Secrets should live in OS-backed secure storage, not in memory records or vector
indexes.

### Permissions

Permissions should be detailed toggles. Each permission supports:

- deny
- ask every time
- allow for session
- allow for workspace
- always allow

Capabilities include read files, write files, run commands, browse web, call
APIs, access contacts, call people, access vault, write memory, use external
models, install or connect tools, and run background tasks.

## V1 Scope

V1 includes:

- local command center
- unified timeline
- BYO model providers
- manual imports
- workspace indexing
- memory extraction
- memory browser
- compaction
- retrieval
- prompt privacy pipeline
- detailed permissions
- read, summarize, plan, draft, and approved action workflows

V1 excludes:

- hosted billing
- mobile apps
- live connectors
- phone calls
- plugin marketplace
- team workspaces
- default autonomous background agents

## Error Handling

Future should be honest when it lacks context, lacks permission, cannot access a
tool, cannot safely complete an action, or has uncertain memory. The assistant
should ask for missing information instead of pretending to know.

## Testing Strategy

Early implementation should include:

- import parser tests
- event store tests
- memory extraction tests
- retrieval ranking tests
- context pack tests
- redaction tests
- permission enforcement tests
- provider adapter tests with mocked APIs
- UI tests for timeline, memory browser, and permission approval flows

## Open Decisions

- final project name
- desktop wrapper timing
- implementation stack
- local vector store choice
- default PII policies
- first demo workflow
- plugin boundary for connectors and phone calls
