# Plan 2 — Remembering Memory (Auto-Capture) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Singularity automatically remember salient facts a user states in chat, so later turns can retrieve them — without the user manually creating memories.

**Architecture:** Add a pure `extractSalientFacts` function in `@future/core`, then hook it into the assistant turn lifecycle after a turn completes: each extracted fact becomes an approved `memory` via the existing `MemoryService.create`, deduped against existing statements, and gated by a per-workspace `autoCapture` setting. Retrieval/embeddings/hybrid ranking already exist and need no change.

**Tech Stack:** TypeScript, Vitest. Reuses `MemoryService`, `EmbeddingRepository`, and the existing hybrid retrieval — no `sqlite-vec` (deferred per Spec §4 Unit D revision).

**Scope note:** Spec Unit D (sqlite-vec) is **deferred** — hybrid semantic retrieval already works. This plan is **Unit E only**.

**Model assignments (subagent dispatch):**

| Task                             | Model      | Why                                            |
| -------------------------------- | ---------- | ---------------------------------------------- |
| 1 `extractSalientFacts`          | **Sonnet** | Heuristic correctness / false-positive control |
| 2 Dedupe helper                  | **Haiku**  | Small pure function                            |
| 3 Auto-capture in turn lifecycle | **Sonnet** | Touches the critical completion path           |
| 4 `autoCapture` setting + wiring | **Haiku**  | Config plumbing                                |

**Prerequisite:** Branch `feat/v2-chat-first-memory`. Plan 1 not required to start, but if both land, auto-capture must run on the redacted-safe completion path (facts are stored locally in full — the boundary filter from Plan 1 protects them at egress).

---

## Task 1: `extractSalientFacts`

A deterministic v1 heuristic: capture short, first-person declarative statements the user makes about themselves ("my dog's name is Ada", "I work at Acme"). No model call — testable and offline.

**Files:**

- Create: `packages/core/src/salience.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/salience.test.ts`

- [ ] **Step 1: Write the failing test `packages/core/src/salience.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { extractSalientFacts } from "./salience";

describe("extractSalientFacts", () => {
  it("captures first-person declarative facts", () => {
    const facts = extractSalientFacts("My dog's name is Ada. I work at Acme.");
    expect(facts).toContain("My dog's name is Ada.");
    expect(facts).toContain("I work at Acme.");
  });

  it("ignores questions and non-first-person sentences", () => {
    const facts = extractSalientFacts("What is the weather? The sky is blue.");
    expect(facts).toEqual([]);
  });

  it("ignores overly long sentences (likely not a durable fact)", () => {
    const long = "I " + "really ".repeat(60) + "think so.";
    expect(extractSalientFacts(long)).toEqual([]);
  });

  it("dedupes repeated facts within one message", () => {
    expect(extractSalientFacts("I like tea. I like tea.")).toEqual(["I like tea."]);
  });

  it("returns an empty array for empty input", () => {
    expect(extractSalientFacts("   ")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/core exec vitest run src/salience.test.ts`
Expected: FAIL — `Cannot find module './salience'`.

- [ ] **Step 3: Implement `packages/core/src/salience.ts`**

```ts
const FIRST_PERSON = /\b(i|i'm|i've|my|mine|me)\b/i;
const QUESTION_OR_IMPERATIVE = /[?]/;
const MAX_WORDS = 40;

/**
 * Deterministic v1 salience heuristic: keep short, first-person declarative
 * sentences. Intentionally conservative to avoid capturing noise. A future
 * task may replace this with a local-model summarizer behind the same signature.
 */
export function extractSalientFacts(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const facts: string[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences) {
    if (QUESTION_OR_IMPERATIVE.test(sentence)) continue;
    if (!FIRST_PERSON.test(sentence)) continue;
    if (sentence.split(/\s+/).length > MAX_WORDS) continue;
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push(sentence);
  }
  return facts;
}
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`**

```ts
export * from "./salience";
```

- [ ] **Step 5: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/core exec vitest run src/salience.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck and commit**

```bash
CI=true corepack pnpm --filter @future/core typecheck
git add packages/core/src/salience.ts packages/core/src/index.ts packages/core/src/salience.test.ts
git commit -m "feat(memory): add deterministic salient-fact extractor"
```

---

## Task 2: Dedupe against existing memory statements

**Files:**

- Create: `apps/api/src/services/auto-capture.ts`
- Test: `apps/api/src/services/auto-capture.test.ts`

- [ ] **Step 1: Write the failing test `apps/api/src/services/auto-capture.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { selectNewFacts } from "./auto-capture";

describe("selectNewFacts", () => {
  it("drops facts that already exist as memory statements (case-insensitive)", () => {
    const result = selectNewFacts(["I like tea.", "My name is Ada."], ["i like tea."]);
    expect(result).toEqual(["My name is Ada."]);
  });

  it("returns all facts when none exist yet", () => {
    expect(selectNewFacts(["I like tea."], [])).toEqual(["I like tea."]);
  });

  it("normalizes trailing whitespace/period differences", () => {
    expect(selectNewFacts(["I like tea"], ["I like tea."])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/api exec vitest run src/services/auto-capture.test.ts`
Expected: FAIL — `Cannot find module './auto-capture'`.

- [ ] **Step 3: Implement `apps/api/src/services/auto-capture.ts`**

```ts
function normalize(statement: string): string {
  return statement
    .trim()
    .replace(/[.!?]+$/, "")
    .toLowerCase();
}

export function selectNewFacts(candidates: readonly string[], existingStatements: readonly string[]): string[] {
  const existing = new Set(existingStatements.map(normalize));
  const chosen: string[] = [];
  const seen = new Set<string>();
  for (const fact of candidates) {
    const key = normalize(fact);
    if (existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    chosen.push(fact);
  }
  return chosen;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/api exec vitest run src/services/auto-capture.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/auto-capture.ts apps/api/src/services/auto-capture.test.ts
git commit -m "feat(memory): dedupe auto-capture candidates against existing memory"
```

---

## Task 3: Hook auto-capture into turn completion

After a turn completes (`assistant-service.ts` ~line 242, `updateState(turnId, "completed", ...)`), extract facts from the user message, drop duplicates, and create approved memories. Approved (not proposed) so they are immediately retrievable — fulfilling "remembers everything." Wrapped in try/catch so capture failure never fails the turn.

**Files:**

- Modify: `apps/api/src/services/assistant-service.ts` (after the `complete()` transaction runs)
- Modify: `apps/api/src/server/dependencies.ts` (inject `memoryService`, `memories` reader, and `getSettings`)
- Test: `apps/api/src/services/assistant-service.test.ts`

- [ ] **Step 1: Read the completion path**

Run: `CI=true corepack pnpm exec grep -n "complete()\|updateState(turnId, \"completed\"\|getUserMessage\|dependencies" apps/api/src/services/assistant-service.ts`
Confirm `complete()` is invoked right after the transaction is defined, and `message` (the user text) is in scope.

- [ ] **Step 2: Add a failing integration test**

Use the file's existing `setup()`/turn helper. Add:

```ts
// After a completed turn whose user message was "My dog's name is Ada.",
// assert a memory with that statement exists for the workspace and is retrievable.
// With autoCapture disabled in settings, assert NO such memory is created.
```

Concretely: run a turn to completion via the existing streaming helper, then query `ctx.memories.listForWorkspace("w_1")` (or the repo's list method) and assert one entry has `statement === "My dog's name is Ada."`; and a second case with `getSettings` returning `{ autoCapture: false }` asserts zero.

- [ ] **Step 3: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/api exec vitest run src/services/assistant-service.test.ts`
Expected: FAIL — no memory is auto-created.

- [ ] **Step 4: Implement the capture hook**

At the top of `assistant-service.ts` add:

```ts
import { extractSalientFacts } from "@future/core";
import { selectNewFacts } from "./auto-capture";
```

Immediately after `complete();` runs and before yielding the terminal frame, add:

```ts
try {
  if (this.dependencies.getSettings(building.workspaceId).autoCapture) {
    const facts = extractSalientFacts(message);
    if (facts.length > 0) {
      const existing = this.dependencies.memories.listForWorkspace(building.workspaceId).map((m) => m.statement);
      for (const statement of selectNewFacts(facts, existing)) {
        this.dependencies.memoryService.create({
          workspaceId: building.workspaceId,
          statement,
          reviewState: "approved",
          source: "auto_capture",
        });
      }
    }
  }
} catch {
  // auto-capture is best-effort; never fail a completed turn
}
```

> Match `CreateMemoryRecordInput`'s actual fields — run `grep -n "CreateMemoryRecordInput" packages/core/src/*.ts packages/db/src/**/*.ts` and include exactly the required properties (e.g. `namespaceId`, `confidence`) with sensible defaults if the type demands them. If there is no `source` field, omit it (it is a nice-to-have label, not required).

In `dependencies.ts`, pass `memoryService`, the `memories` repository, and a `getSettings(workspaceId): { autoCapture: boolean; redactLocalToo: boolean }` reader (default `autoCapture: true`) into the assistant-service deps.

- [ ] **Step 5: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/api exec vitest run src/services/assistant-service.test.ts`
Expected: PASS (existing + 2 new cases).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/assistant-service.ts apps/api/src/server/dependencies.ts apps/api/src/services/assistant-service.test.ts
git commit -m "feat(memory): auto-capture salient facts on turn completion"
```

---

## Task 4: `autoCapture` setting persistence

Persist the toggle so the Settings drawer (Plan 3) can flip it. Store on the workspace/settings row alongside `redactLocalToo` from Plan 1.

**Files:**

- Modify: the workspace/settings repository and its migration (find with `grep -rn "redactLocalToo\|settings" apps/api/src packages/db/src`)
- Test: colocate with the settings repository test

- [ ] **Step 1: Write a failing test**

Assert `getSettings(workspaceId)` returns `{ autoCapture: true, redactLocalToo: false }` by default and reflects an update to `autoCapture: false`.

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true corepack pnpm --filter @future/api exec vitest run <settings-test-file>`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add an `auto_capture` boolean column (default 1) to the settings/workspace row (new migration if Plan 1 didn't already add a settings table; otherwise extend it). Expose `getSettings`/`updateSettings` reading/writing `autoCapture` and `redactLocalToo`.

> If Plan 1 already created a settings table for `redactLocalToo`, **extend that table** rather than creating a second one. Coordinate the migration number so it is sequential.

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true corepack pnpm --filter @future/api exec vitest run <settings-test-file>`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src packages/db/src
git commit -m "feat(settings): persist autoCapture toggle"
```

---

## Final verification (Plan 2)

- [ ] Run the full gate:

```bash
CI=true corepack pnpm check
```

Expected: typecheck, lint, format, all tests pass.

- [ ] Confirm Spec §4 Unit E acceptance: a fact stated in chat is retrievable in a later turn via existing hybrid search; auto-capture is idempotent (no duplicate memory for the same fact) and fully disabled by the toggle.

## Spec-coverage note

- Unit E ✅ Tasks 1–4. Unit D (sqlite-vec) intentionally **deferred** — see Spec §4 Unit D revision; hybrid semantic retrieval already ships.
