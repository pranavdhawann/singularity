# Launch FAQ

## Is Future a model?

No. Future owns the local memory, retrieval, citation, and permission layer. Models are replaceable runtimes.

## Does it work offline?

The deterministic demo and mock provider do. Ollama can keep generation local after the model is installed. External profiles require network access only after explicit prompt approval.

## Where is data stored?

In local SQLite under `.future/` by default. The database is not encrypted at rest in `v0.1.0`.

## What can I import?

Markdown, plain text, and ChatGPT JSON exports. Imports are size-limited, checkpointed, and retryable.

## Does approval cover later calls?

No. A grant binds to one exact turn, provider, profile, model, context-pack hash, and final prompt hash. Changed inputs invalidate it.

## Does Future act autonomously?

No. Autonomous external actions, broad integrations, cloud accounts, and teams are out of scope for this release.

## Why is the repository named singularity?

Future is the product name. `singularity` is the existing repository name. A later rename may improve discovery, but `v0.1.0` does not change repository identity.
