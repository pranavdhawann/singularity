# Memory Architecture

Future's memory system should be layered. Vector search alone is not enough.

## Goals

- Store raw history locally.
- Compact long histories without losing source links.
- Extract stable facts, decisions, preferences, and procedures.
- Retrieve the right context for a task.
- Let users inspect, edit, and delete memory.
- Preserve provenance.

## Layers

### 1. Raw Event Log

The event log is the source of truth. It stores:

- commands
- responses
- imported messages
- imported files
- model calls
- permission changes
- action proposals
- approvals and denials
- action results
- compaction jobs
- memory extraction jobs

Events should be append-only where possible. If a user deletes data, the system
should tombstone or purge according to local policy.

### 2. Compaction Ledger

Compactions summarize raw events into durable records.

Useful compaction types:

- daily summaries
- project summaries
- topic summaries
- person summaries
- task summaries
- decision summaries
- error and blocker summaries

Compactions should link back to source event IDs.

### 3. Fact Memory

Fact memory stores stable statements such as:

- user preferences
- project names
- recurring constraints
- active goals
- important dates
- relationships
- tool choices
- writing style preferences

Facts should include:

- source IDs
- confidence
- last confirmed date
- workspace scope
- privacy classification
- expiry or review policy

### 4. Episodic Memory

Episodic memory stores what happened:

- "On this date, the user decided X."
- "This bug was fixed by changing Y."
- "The user rejected approach Z."
- "This project used provider A for reason B."

### 5. Procedural Memory

Procedural memory stores how the user likes work done:

- preferred verification commands
- documentation style
- code review preferences
- planning style
- approval behavior
- formatting preferences

### 6. Retrieval Planner

Before a model call, the retrieval planner should decide which context to use:

- recent timeline events
- workspace summary
- relevant facts
- relevant episodes
- procedural preferences
- raw source snippets
- pinned memories

The system should show which memories were used.

## Suggested Local Storage

Start simple:

- SQLite for events, metadata, providers, permissions, jobs, and memory records.
- SQLite FTS for lexical search.
- sqlite-vec or LanceDB for local vector search.
- Local filesystem for imported files and extracted text.
- OS keychain for secrets and API keys.

## Memory Quality Loop

Memory should be user-correctable.

Flow:

1. Extract candidate memory.
2. Assign type, scope, confidence, and sources.
3. Show uncertain or sensitive memories for review.
4. Promote approved memory.
5. Use memory in future retrieval.
6. Let the user edit, delete, or mark outdated.

## Long Context Strategy

A 200k context model is useful, but it should not replace memory architecture.
Future should build compact, source-backed context packs:

- system and behavior instructions
- active workspace summary
- recent timeline
- relevant facts
- relevant episodes
- selected raw snippets
- user-selected attachments
- permission state

The context pack should fit the selected model rather than assuming every model
has the same window.
