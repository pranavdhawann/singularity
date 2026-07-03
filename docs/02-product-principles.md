# Product Principles

## 1. Memory Is the Product

Future should treat memory as a visible, editable, source-backed system. Users
should be able to see what the assistant knows, why it knows it, and how that
knowledge affects responses.

## 2. Chat Is a Data Source, Not the Interface

The product should not center on endless chat threads. Conversations, imported
chats, commands, actions, compactions, and decisions all flow into one timeline.

## 3. Local First, Cloud Optional

User history, memory, indexes, permissions, and audit logs should live locally
by default. Cloud model APIs are optional provider calls, not the source of
truth.

## 4. Model Agnostic by Design

Future should support multiple providers through a common interface:

- OpenAI
- Anthropic
- Google
- OpenRouter
- Ollama
- LM Studio
- OpenAI-compatible endpoints

Provider-specific strengths can be exposed, but the core product should not
depend on one model vendor.

## 5. Permissions Must Be Visible

The assistant should never leave users guessing about what it can access or do.
Permissions should be detailed, inspectable, and easy to revoke.

## 6. Honesty Over Pretending

The assistant should say when it lacks context, lacks permission, is uncertain,
or needs user direction. It should ask for the missing input instead of hiding
the gap.

## 7. Provenance Beats Magic

Answers and actions should link back to memories, files, timeline events,
imports, or user decisions. When the assistant uses context, users should be
able to inspect that context.

## 8. Small Core, Plugin Edge

The core should handle memory, timeline, permissions, model routing, and local
UI. Riskier or broader integrations such as phone calls, email, Slack, calendar,
and browser automation should be plugins.
