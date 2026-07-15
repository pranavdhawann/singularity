# Singularity v2 — Chat-First, Always-On Redaction, Remembering Memory

**Status:** Draft for review
**Date:** 2026-07-15
**Spec:** 1 of 2 (this spec = core + memory; Spec 2 = the "does everything" tool/action subsystem, brainstormed separately)

## 1. Purpose & north star

Singularity was meant to be **one place where a human and their AI act as one**: a
single, continuous chat with a personal assistant that is **model-agnostic**,
**remembers everything locally**, and **protects the human's PII by default**.

The current build drifted into a multi-lens operations console with per-workspace
timelines and external-only redaction. This spec realigns it to the original
intent without throwing away the strong local primitives already in place
(durable timeline, resumable imports, FTS5 retrieval, immutable prompt grants).

### Goals

1. **One chat is the whole app.** A single conversation is the primary surface; a
   gear-icon settings drawer absorbs today's Memory/Imports/Providers/Permissions
   lenses.
2. **Model-agnostic, both directions.** Local (Ollama) and cloud (Anthropic
   Claude, OpenAI) with the user's own API key, entered in settings.
3. **Always-on PII redaction, on by default** (behavior "mode C": auto-mask, pause
   only on high-risk, cloud-gated, local toggle).
4. **Remembers everything locally.** Hybrid keyword + semantic retrieval
   (FTS5 + `sqlite-vec`) and automatic capture of salient facts from the chat,
   with sources stored as AI-friendly Markdown/JSON that the index points to.

### Non-goals (this spec)

- The tool/action "does everything" agent subsystem (that is Spec 2).
- Desktop packaging, encrypted-at-rest storage, cloud sync, multi-user isolation
  (remain deferred; unchanged from current known limitations).
- Multi-workspace UX. Workspaces remain an internal concept but collapse to a
  single implicit default in the UI.

### Core principle: redaction is a boundary filter, not a storage filter

PII lives **in full, locally** — in source files, the index, and captured memory.
The redaction engine is a **filter at the egress boundary** (what leaves the
machine to a cloud model), not something that strips your own data from your own
memory. This is what makes "remembers everything" and "PII-safe" coexist: the
machine remembers your real details; the boundary protects them when they would
otherwise leave.

## 2. Documented research (mid-2026)

Findings that shaped the technical choices below.

**PII detection/redaction.** Microsoft **Presidio** is the de-facto orchestration
layer (regex/checksum recognizers + pluggable ML NER + anonymize operators), but
it is **Python-only** — a real cost for a Node app that must stay "easy to run."
The strongest small on-device ML detector is **GLiNER-PII** (zero-shot, 50+
entity types, runs via **ONNX Runtime** with no server); **Piiranha** is the best
small multilingual alternative. Benchmarks converge on one rule: **regex for
structured PII + a small model for freeform text** beats either alone.

- [Grepture: best OSS PII models](https://grepture.com/blog/best-open-source-models-pii-redaction)
- [Benchmarking OSS PII detection](https://albertsikkema.com/python/security/privacy/2026/06/01/benchmarking-open-source-pii-detection.html)
- [Presidio overview](https://blog.octabyte.io/posts/development/presidio/presidio-presidio-open-source-framework-for-pii-detection-redaction-anonymization/)

**Local memory / retrieval.** The emerging best practice for single-user local
memory is exactly Singularity's stack: **SQLite + `sqlite-vec` + FTS5, fully
embedded, no cloud** — see the reference project
[memoirs](https://github.com/misaelzapata/memoirs). Heavier frameworks
(Cognee/Mem0) add graph stores and dependencies not justified for one local user.

- [memoirs — local-first memory engine](https://github.com/misaelzapata/memoirs)
- [AI agent memory architecture (SQLite → vector)](https://www.shareuhack.com/en/posts/ai-agent-memory-architecture-indie-maker-2026)

**Local embeddings.** `nomic-embed-text` (274 MB, CPU-friendly, 8k context) via
Ollama is the laptop-friendly default; `all-MiniLM-L6-v2` (46 MB) if smaller is
needed. Served locally by Ollama at `POST /api/embed`, no key, $0.

- [Ollama embedding models benchmarked](https://www.morphllm.com/ollama-embedding-models)

**Local assistant models & tool-calling.** Llama 3.2 3B / Qwen2.5 3B via Ollama
are the "runs anywhere" tier; small-model tool-calling is improving but still
unreliable — a reason to defer the agent subsystem to Spec 2 and keep Spec 1's
model use to plain chat + retrieval.

- [Function calling on local LLMs](https://insiderllm.com/guides/function-calling-local-llms/)

## 3. Architecture overview

```text
                         ┌─────────────────────────────┐
   Single chat UI  ─────▶│  Fastify /api/v2            │
   + gear settings drawer│                             │
                         │  Assistant turn lifecycle   │
                         │        │                    │
                         │        ▼                    │
                         │  RedactionEngine (always-on)│──▶ high-risk? → approval preview
                         │        │  (boundary filter) │
                         │        ▼                    │
   Ollama / Claude / ◀───│  Provider layer (BYO key)   │
   OpenAI                │        │                    │
                         │        ▼                    │
                         │  Retrieval: FTS5 + sqlite-vec (hybrid)
                         │        │                    │
                         │        ▼                    │
                         │  SQLite  +  .future/sources/*.md|json (AI-friendly)
                         └─────────────────────────────┘
```

The browser never talks to SQLite directly (unchanged). Redaction sits on the
egress path inside the turn lifecycle. Memory capture and retrieval sit on the
local side of that boundary and may hold full PII.

## 4. Work units (structured for subagent-driven development)

Each unit below is an **independently dispatchable task**: it states its purpose,
its public interface, what it depends on, the files it touches, and testable
acceptance criteria. The dependency graph in §5 says which can run in parallel.

Conventions: keep contracts in `packages/core`; keep engines/providers in focused
workspace packages; colocate `*.test.ts`; every unit ships with tests and passes
`pnpm typecheck && pnpm lint && pnpm format:check`.

---

### Unit A — Native Anthropic & OpenAI providers + SecretStore

**Purpose.** Let a user paste an Anthropic or OpenAI API key in settings and chat
against Claude or GPT, alongside existing Ollama and mock providers.

**Interface.**

- Extend the existing `ModelProvider` contract (`packages/providers`) with two new
  implementations: `AnthropicProvider` (Messages API, streaming) and
  `OpenAiProvider` (Chat Completions, streaming). Both classify as `external`
  (non-local) so the redaction boundary applies.
- New `SecretStore` abstraction (`packages/core` contract + impl in `apps/api`):
  `get(name): string | undefined`, `set(name, value): void`, `list(): string[]`.
  Default impl writes `.future/secrets.json` (gitignored, file mode `0600`),
  keyed by name; provider config continues to persist only the `env:NAME`
  **reference**, never the value (existing pattern preserved).

**Depends on.** Nothing (backend-only).

**Files.** `packages/providers/src/anthropic.ts`, `.../openai.ts`,
`packages/core/src/secrets.ts`, `apps/api/src/services/provider-service.ts`,
`apps/api/src/server/dependencies.ts`, colocated tests, `.gitignore`.

**Acceptance criteria.**

- Given a stored Anthropic key, an assistant turn streams a Claude response
  through the existing SSE turn lifecycle; cancellation works.
- Same for OpenAI/GPT.
- Secret values never appear in SQLite rows, timeline payloads, or logs (assert in
  tests). Provider config stores only `env:NAME`.
- Missing/invalid key yields a safe, typed diagnostic (reuses connection-test).

**Security note (confirm on review).** `.future/secrets.json` is **not encrypted
at rest** in this spec — consistent with current known limitations. A follow-up
may move to OS keychain (`keytar`). Documented in SECURITY.md.

---

### Unit B — Pluggable redaction engine (Node-first default, mode C)

**Purpose.** An always-on PII engine that analyzes text and produces a redacted
form plus typed entity metadata, with a Node-only default so the app stays
single-runtime.

**Interface (`packages/permissions`, upgrading existing `redaction.ts`).**

```ts
interface RedactionEntity {
  type: string; // "email" | "credit_card" | "person" | ...
  start: number;
  end: number;
  risk: "low" | "high";
  detector: "regex" | "ml";
}
interface RedactionResult {
  redacted: string; // typed placeholders, e.g. [EMAIL_1]
  entities: RedactionEntity[];
  counts: Record<string, number>;
  hasHighRisk: boolean;
}
interface RedactionEngine {
  analyze(text: string): Promise<RedactionEntity[]>;
  redact(text: string, policy: RedactionPolicy): Promise<RedactionResult>;
}
```

- **Default impl `NodeRedactionEngine`:** regex/checksum recognizers (email, phone,
  credit card w/ Luhn, SSN, IBAN, IP, API-key/secret patterns) **plus** optional
  freeform NER (person, address, org) via **GLiNER-PII** through
  `onnxruntime-node`. If the ONNX model is absent, degrade gracefully to
  regex-only and surface that state.
- **Optional impl `PresidioSidecarEngine`:** opt-in; spawns a local Python
  Presidio service and implements the same interface. Ships **disabled**; the
  interface exists so it can be selected in settings by advanced users.
- **Risk map:** financial IDs, government IDs, medical, and credentials/secrets =
  `high`; names, emails, phones, addresses, orgs, URLs, IPs = `low`. Configurable.

**Depends on.** Nothing (backend-only).

**Files.** `packages/permissions/src/redaction.ts` (upgrade),
`.../redaction-node.ts`, `.../redaction-presidio.ts`, `.../risk-map.ts`,
`packages/core/src/redaction.ts` (shared types), colocated tests.

**Acceptance criteria.**

- Structured PII (email, card via Luhn, SSN) is detected by regex and masked with
  stable typed placeholders; unit tests cover true/false positives.
- With the ONNX model present, a freeform name/address is detected as `person`/
  `address`; without it, the engine returns regex-only results and a
  `mlAvailable: false` signal (no crash).
- `redact()` is deterministic for identical input; `counts` and `hasHighRisk` are
  correct.
- Engine selection is pluggable behind the interface; swapping impls needs no
  change in callers.

---

### Unit C — Wire always-on redaction into the turn lifecycle (mode C)

**Purpose.** Replace today's external-only redaction (`if (!isLocal)` in
`assistant-service.ts:82`) with the always-on boundary policy.

**Behavior (mode C).**

- **Every** outbound turn runs `RedactionEngine.redact` on the fully assembled
  prompt.
- **Cloud (external) provider:** send the **redacted** prompt. If
  `hasHighRisk`, pause into the existing `awaiting_approval` prompt-preview flow
  (reuse `ExternalPromptPreview`, already focus-trapped from PR #18); otherwise
  send automatically and record safe redaction counts to the timeline.
- **Local (Ollama/mock) provider:** send **unredacted** by default; if the
  workspace/global setting `redactLocalToo` is on, apply masking as well.
- Approval binding (turn, provider, model, context-pack hash, prompt hash) is
  preserved and now also binds the redaction summary.

**Depends on.** Unit B (engine), Unit A (so cloud providers exist to gate).

**Files.** `apps/api/src/services/assistant-service.ts`,
`apps/api/src/services/prompt-preview-service.ts`,
`packages/core/src/prompt-preview.ts` (add redaction summary + risk flag),
colocated tests.

**Acceptance criteria.**

- Low-risk cloud turn: auto-masked, no pause, streams; timeline shows redaction
  counts, never raw PII.
- High-risk cloud turn: pauses in `awaiting_approval`; approve → sends redacted;
  deny → no model call; both auditable.
- Local turn with `redactLocalToo=false`: unredacted send. With `true`: masked.
- No secret, raw pre-redaction prompt, or provider body is ever written to a
  timeline event (asserted).

---

### Unit D — hybrid retrieval (ALREADY LARGELY IMPLEMENTED — deferred)

> **Revised 2026-07-15 after code exploration.** The repo **already** has hybrid
> retrieval and local embeddings: `packages/retrieval/src/hybrid.ts`
> (`rankHybridCandidates`, lexical 0.65 + vector 0.35), `ollama-embeddings.ts`
> (`/api/embed`), `openai-embeddings.ts`, an `EmbeddingRepository` that persists
> vectors, and `context-service.ts` which computes `vectorScore` via JS cosine
> over stored embeddings. **Semantic recall works today.**
>
> The only thing `sqlite-vec` would add is pushing cosine similarity from
> JavaScript into SQL — a **performance/scale optimization**, not a missing
> capability. For a single local user with tens of thousands of entries the
> current approach is sufficient (YAGNI).
>
> **Decision:** `sqlite-vec` is **deferred** out of Spec 1. It becomes a future
> optimization task if/when profiling shows JS cosine is a bottleneck. Plan 2
> therefore covers **only Unit E (auto-capture)** — the genuinely new pillar-③
> value. No `0005-vec-chunks` migration in this release.

---

### Unit E — Local embedding provider + auto-capture

**Purpose.** Produce embeddings locally and automatically remember salient facts
from the chat.

**Interface.**

- `EmbeddingProvider` contract with an `OllamaEmbeddingProvider` default
  (`nomic-embed-text` via `POST /api/embed`). **Local-only**: text is never sent
  to a cloud endpoint for embedding. If Ollama is unavailable, embeddings are
  skipped and the system stays FTS-only.
- **Auto-capture:** after a turn completes, extract salient, durable facts (v1: a
  bounded heuristic + optional local-model summarization) and write them as
  `memory` entries via the existing memory lifecycle. Captured memory may hold
  full PII (boundary principle). On by default; a settings toggle disables it.

**Depends on.** Unit D (vectors), existing memory service.

**Files.** `packages/providers/src/embeddings.ts`,
`apps/api/src/services/memory-service.ts` (auto-capture hook),
`apps/api/src/services/assistant-service.ts` (post-turn trigger), colocated tests.

**Acceptance criteria.**

- Imported and captured content is embedded locally when Ollama is present.
- A fact stated in chat ("my dog's name is Ada") is retrievable in a later turn
  via hybrid search.
- Auto-capture is idempotent (no duplicate memory for the same fact) and fully
  disabled by the toggle.

---

### Unit F — Chat-first shell (single conversation is the app)

**Purpose.** Make the conversation the whole primary surface; retire the 6-lens
console layout.

**Scope.**

- Replace the `navigationItems` console + content-grid in
  `apps/web/src/app/App.tsx` with a single chat view built from the existing
  `TimelineView` + `AssistantComposer`.
- Add a top-bar **gear icon** that opens the Settings drawer (Unit G).
- Add a compact **redaction badge** in the composer/turn area: "N items redacted"
  with a click-to-reveal/allow affordance, driven by Unit C's redaction summary.
- Keep the model-profile quick-switch accessible (small control in the chat
  header), since model-agnostic switching is core.

**Depends on.** Unit G (drawer) for the settings target; Unit C for the badge
data shape (can stub until C lands).

**Files.** `apps/web/src/app/App.tsx`, `apps/web/src/features/assistant/*`,
`apps/web/src/features/timeline/*`, `apps/web/src/styles/global.css`, tests.

**Acceptance criteria.**

- First paint after setup is a single chat, no lens tabs.
- Sending a message, streaming, cancel, and citation inspection all work from the
  single view.
- Redaction badge appears when the last turn masked anything and reveals the typed
  entity summary on demand; component tests cover it.

---

### Unit G — Settings drawer (gear) absorbing the old lenses

**Purpose.** Give every non-chat surface a home behind the gear icon.

**Scope.**

- A drawer/modal with sections: **Providers** (add/edit provider + paste API key →
  Unit A), **Memory** (existing `MemoryWorkspace`), **Imports** (existing
  `ImportWorkspace`, already improved in PR #18), **Permissions/Privacy** (redaction
  mode, `redactLocalToo`, engine choice Node/Presidio, auto-capture toggle), and
  **About**.
- Reuse existing feature components as drawer panels rather than rewriting them.
- Full keyboard accessibility and focus trapping (reuse the dialog pattern
  established in PR #18's `ExternalPromptPreview`).

**Depends on.** Reuses existing feature components; can be built in parallel with F.

**Files.** `apps/web/src/features/settings/SettingsDrawer.tsx` (new) + panel
wrappers, `apps/web/src/app/App.tsx`, `global.css`, tests.

**Acceptance criteria.**

- Gear opens the drawer; Esc/overlay close it; focus is trapped and restored.
- Each panel renders its existing feature and remains functional.
- Privacy panel persists redaction mode, `redactLocalToo`, engine choice, and
  auto-capture toggle.

---

### Unit H — Single implicit workspace

**Purpose.** Remove "different chats" from the UX while keeping the workspace
concept internally.

**Scope.**

- Auto-select/create one default workspace on boot; remove `WorkspaceSwitcher`
  from the primary UI (may remain in an advanced settings area, off by default).
- First-run setup creates exactly one workspace silently.

**Depends on.** None; coordinate with F (shell) since both touch `App.tsx`.

**Files.** `apps/web/src/app/App.tsx`, `apps/web/src/features/setup/FirstRunSetup.tsx`,
`apps/web/src/features/workspaces/*`, tests.

**Acceptance criteria.**

- No workspace switcher on the primary surface; the app always operates on one
  implicit workspace.
- Existing per-workspace API calls still receive the resolved default id.

## 5. Dependency graph & parallelization

```text
Backend track:    A ─┐
                  B ─┼─▶ C
                  D ─┴─▶ E
Frontend track:   H ─┬─▶ F ◀── (badge data from C)
                  G ─┘
```

- **Parallelizable immediately:** A, B, D, H, G (independent).
- **Second wave:** C (needs A+B), E (needs D), F (needs G; consumes C's shape).
- Good split for subagent-driven development: one subagent per unit in wave 1,
  then wave 2 once interfaces from wave 1 are merged.

## 6. Data model changes

- `vec_chunks` virtual table (Unit D migration `0005`).
- `prompt_previews` / prompt-preview DTO gains a redaction summary + `hasHighRisk`
  (Unit C).
- New settings persisted (redaction mode, `redactLocalToo`, engine choice,
  auto-capture) — store on the workspace/settings row.
- `.future/secrets.json` (Unit A) and `.future/sources/*.md|json` (AI-friendly
  source mirrors the index points to).

## 7. Testing strategy

- **Unit:** each engine/provider/retrieval function (regex recognizers, Luhn,
  hybrid ranking, provider streaming with mocked transports).
- **Integration (api):** turn lifecycle across local/cloud × low/high-risk;
  secret-leak assertions; migration idempotency.
- **Component (web):** single-chat render, redaction badge, settings drawer focus
  trapping, no-switcher primary surface.
- **E2E (Playwright):** import → ask → hybrid-cited answer → high-risk cloud turn
  pauses → approve → streamed redacted answer, fully offline for local paths.
- Gate everything on `pnpm check` (typecheck, lint, format, tests) + the existing
  frozen-install CI.

## 8. Open decisions to confirm on review

1. **Redaction engine strategy = C** (Node default, Presidio opt-in). Confirm, or
   switch to A (Presidio-only sidecar) / B (Node-only, drop Presidio).
2. **Secret storage** = local `.future/secrets.json` (0600, unencrypted) for now,
   keychain later. Acceptable for this release?
3. **Auto-capture default = on.** Keep on-by-default, or ship off-by-default until
   it proves accurate?
4. **Embedding model default = `nomic-embed-text` via Ollama.** OK, or prefer the
   smaller `all-MiniLM-L6-v2`?
5. **GLiNER-PII model distribution** — bundle the ONNX weights vs. fetch on first
   run (affects install size and offline-first). Preference?

## 9. Out of scope → Spec 2 ("does everything")

The tool/action agent (function-calling, external actions, scheduling) is a
separate brainstorm and spec, deliberately deferred because reliable small-model
tool-calling is still maturing (see §2 research).
