# Launch FAQ

## Is Singularity a model?

No. Singularity owns the local memory, retrieval, citation, and permission layer. Models are replaceable runtimes.

## Does it work offline?

The deterministic demo and mock provider do. Ollama can keep generation local after the model is installed. External profiles require network access only after explicit prompt approval.

## Where is data stored?

In local SQLite under `.future/` by default. The database is not encrypted at rest in `v0.2.0`.

## What can I import?

Markdown, plain text, and ChatGPT JSON exports. Imports are size-limited, checkpointed, and retryable.

## Does approval cover later calls?

No. A grant binds to one exact turn, provider, profile, model, context-pack hash, and final prompt hash. Changed inputs invalidate it.

## Does Singularity act autonomously?

No. Autonomous external actions, broad integrations, cloud accounts, and teams are out of scope for this release.

## Why is the repository named singularity?

Singularity is both the product and repository name. Internal `@future/*` package scopes and `FUTURE_*` environment variables remain compatibility identifiers until a later internal migration.
