import type { PromptBindingInput, SourceReference } from "@future/core";
import { createHash } from "node:crypto";
import {
  redactSensitiveText,
  type RedactionResult
} from "./redaction";

export interface ExternalPromptSegment {
  source: SourceReference;
  text: string;
  privacyLabels: string[];
  excluded?: boolean;
}

export interface ExternalPromptPreviewInput {
  turnId: string;
  providerId: string;
  modelProfileId: string;
  model: string;
  contextPackId: string;
  contextPackHash: string;
  instructions: string;
  userText: string;
  segments: ExternalPromptSegment[];
}

export interface ExternalPromptPreviewResult extends PromptBindingInput {
  redactedPrompt: string;
  bindingHash: string;
  estimatedTokens: number;
  privacyLabels: string[];
  redactionCounts: Record<string, number>;
  selectedSources: SourceReference[];
  excludedSources: SourceReference[];
}

export class PromptRedactionError extends Error {
  constructor() {
    super("prompt redaction failed");
    this.name = "PromptRedactionError";
  }
}

interface PromptPreviewDependencies {
  redact?: (text: string) => RedactionResult;
}

export function buildExternalPromptPreview(
  input: ExternalPromptPreviewInput,
  dependencies: PromptPreviewDependencies = {}
): ExternalPromptPreviewResult {
  const selected = input.segments.filter((segment) => !segment.excluded);
  const excluded = input.segments.filter((segment) => segment.excluded);
  const renderedPrompt = renderPrompt(input.instructions, input.userText, selected);
  let result: RedactionResult;

  try {
    result = (dependencies.redact ?? redactSensitiveText)(renderedPrompt);
  } catch {
    throw new PromptRedactionError();
  }

  const promptHash = sha256(result.text);
  const binding: PromptBindingInput = {
    turnId: input.turnId,
    providerId: input.providerId,
    modelProfileId: input.modelProfileId,
    model: input.model,
    contextPackId: input.contextPackId,
    contextPackHash: input.contextPackHash,
    promptHash
  };

  return {
    ...binding,
    redactedPrompt: result.text,
    bindingHash: hashPromptBinding(binding),
    estimatedTokens: Math.max(1, Math.ceil(result.text.length / 4)),
    privacyLabels: [...new Set(input.segments.flatMap((segment) => segment.privacyLabels))].sort(),
    redactionCounts: result.redactions.reduce<Record<string, number>>((counts, redaction) => {
      counts[redaction.kind] = (counts[redaction.kind] ?? 0) + 1;
      return counts;
    }, {}),
    selectedSources: selected.map((segment) => segment.source),
    excludedSources: excluded.map((segment) => segment.source)
  };
}

export function hashPromptBinding(input: PromptBindingInput): string {
  return sha256(canonicalJson(input));
}

function renderPrompt(
  instructions: string,
  userText: string,
  segments: ExternalPromptSegment[]
): string {
  const context = segments.map((segment, index) => [
    `[SOURCE ${index + 1}]`,
    `kind: ${segment.source.kind}`,
    `id: ${segment.source.id}`,
    `title: ${segment.source.title}`,
    `privacy: ${[...segment.privacyLabels].sort().join(", ") || "unlabeled"}`,
    segment.text
  ].join("\n")).join("\n\n");

  return [
    "[INSTRUCTIONS]",
    instructions,
    "[CONTEXT]",
    context || "No selected context.",
    "[USER]",
    userText
  ].join("\n\n");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
