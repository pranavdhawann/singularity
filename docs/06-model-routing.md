# Model Routing

Future should be model agnostic from the first release.

## Goals

- Avoid provider lock-in.
- Support cloud and local models.
- Let users choose the right model for each task.
- Keep provider credentials local.
- Record model use in the timeline.
- Respect privacy and permission policies before external calls.

## V1 Provider Targets

- OpenAI
- Anthropic
- Google
- OpenRouter
- Ollama
- LM Studio
- OpenAI-compatible endpoints

## Provider Abstraction

Each provider configuration should include:

- provider ID
- display name
- base URL
- auth type
- supported models
- default model
- context window
- streaming support
- tool calling support
- vision support
- embedding support
- local or external classification
- allowed workspaces

## Model Profiles

Users should be able to create model profiles:

- fast local model
- best reasoning model
- cheap summarizer
- coding model
- privacy-only model
- embedding model

Commands can default to profiles instead of hard-coding models.

## Routing Modes

### Manual

User selects provider and model per command.

### Workspace Default

Workspace has a default model profile.

### Task Default

Summaries, code tasks, long-context questions, embeddings, and privacy-sensitive
tasks can each have defaults.

### Future Smart Routing

Later versions can recommend a model based on context size, privacy labels,
cost, latency, and tool requirements.

## Prompt Privacy Pipeline

Before any external model call:

1. Build candidate context pack.
2. Classify sensitive data.
3. Apply redaction policy.
4. Show prompt preview when required.
5. Send only approved context.
6. Store call metadata in timeline.

## OpenAI-Compatible Adapter

The first implementation can use an OpenAI-compatible interface where possible
and provider-specific adapters where needed.

This keeps the product simple while still supporting richer provider features
over time.
