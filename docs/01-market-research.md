# Market Research

Future should avoid competing as a generic chat UI. The market already has
strong projects in local chat, coding agents, model routing, and memory. The
opportunity is combining the best parts into a local command center where
memory and permissions are first-class.

## Adjacent Categories

### Local and Self-Hosted Assistants

OpenClaw, Open WebUI, AnythingLLM, Jan, and LibreChat show demand for local or
self-hosted assistant interfaces, multiple providers, local models, document
chat, and personal workflows.

Strengths in this category:

- local/self-hosted control
- support for multiple model providers
- document ingestion and RAG
- chat-based familiarity
- some agent and tool features

Gaps Future can target:

- many remain chat-first
- memory inspection and correction is often secondary
- permission state is not always central to the experience
- timelines and compaction ledgers are rarely the primary product model

### Developer AI Tools

Continue, OpenHands, Aider, Cursor, Codex, Claude Code, and Cline show that
developers want AI to understand codebases, edit files, run commands, and carry
tasks across context.

Strengths in this category:

- coding workflow integration
- file editing and terminal execution
- project context
- model provider abstraction
- agentic task loops

Gaps Future can target:

- less focus on personal memory across all work
- coding-first interfaces do not always fit power-user workflows
- long-term timeline, memory correction, and personal context can be weak
- permissions are often tied to tool execution rather than a general trust model

### Memory Layers

Mem0, Letta, Zep, and LangGraph memory patterns show that useful assistant
memory needs more than vector search. Long-term memory often combines facts,
episodes, summaries, procedural preferences, source references, and retrieval
planning.

Strengths in this category:

- reusable memory abstractions
- facts and summaries
- retrieval APIs
- graph or temporal models
- agent-focused memory concepts

Gaps Future can target:

- end-user interfaces for inspecting and editing memory
- a local-first memory ledger
- memory tied directly to permissions and provenance
- workspace-aware assistant history

### Model Routing and Tool Protocols

LiteLLM, OpenRouter, Ollama, LM Studio, OpenAI-compatible APIs, and the Model
Context Protocol make provider choice and tool interoperability easier.

This means model support alone is not a durable moat. Future should use model
routing as infrastructure and compete on user experience, memory quality,
traceability, and control.

## Differentiation

Future should be positioned as:

> A memory-first local assistant IDE for power users and developers.

This is different from:

- chat apps: Future is command-center first
- coding agents: Future is broader than code
- personal assistants: Future is workspace and developer aware
- memory APIs: Future is a full local product

## Strategic Wedge

The first public release should make three things excellent:

1. Import context from chats, notes, docs, and workspaces.
2. Turn that context into inspectable memory with sources.
3. Let users ask or command the assistant from a local command center with
   detailed permissions.
