import type { RedactionEntity } from "@future/core";
import type { MlRecognizer } from "./redaction-engine";
import { riskFor } from "./risk-map";

/** A single PII span predicted by a GLiNER inference session. */
export interface GlinerSpan {
  /** GLiNER entity label, e.g. "email" or "social security number". */
  label: string;
  /** Character offset of the span start (inclusive). */
  start: number;
  /** Character offset of the span end (exclusive). */
  end: number;
  /** Confidence in `[0, 1]`. */
  score: number;
}

/**
 * A loaded GLiNER model. Implemented by an ONNX Runtime session at runtime and
 * mocked in tests. `labels` are the zero-shot entity types to detect.
 */
export interface GlinerSession {
  infer(text: string, labels: string[]): Promise<GlinerSpan[]>;
}

export interface GlinerRecognizerOptions {
  /** Entity labels requested from the model. Defaults to the mapped keys. */
  labels?: string[];
  /** GLiNER label (lowercased) → Singularity redaction type. */
  labelMap?: Record<string, string>;
  /** Minimum score to keep a span. Defaults to 0.5. */
  threshold?: number;
}

/**
 * Default GLiNER label → redaction type. Keys are matched case-insensitively.
 * Types absent from the high-risk set (see risk-map) are treated as low risk,
 * so ML-only categories such as person/location need no schema changes.
 */
export const DEFAULT_GLINER_LABEL_MAP: Record<string, string> = {
  email: "email",
  "email address": "email",
  phone: "phone",
  "phone number": "phone",
  ssn: "ssn",
  "social security number": "ssn",
  "credit card": "credit_card",
  "credit card number": "credit_card",
  iban: "iban",
  "bank account": "bank_account",
  "bank account number": "bank_account",
  passport: "passport",
  "passport number": "passport",
  "medical record number": "medical_record",
  "api key": "secret",
  password: "secret",
  person: "person",
  "person name": "person",
  location: "location",
  address: "address",
  organization: "organization",
};

/**
 * A GLiNER-backed ML recognizer for the redaction engine's ML slot.
 *
 * The recognizer is regex-independent: it maps model spans to redaction
 * entities, applies a score threshold, and assigns risk from the shared
 * risk map. When constructed without a session it reports `available: false`,
 * which keeps the engine on the regex-only (NO_ML) path.
 */
export class GlinerRecognizer implements MlRecognizer {
  private readonly labelMap: Record<string, string>;
  private readonly labels: string[];
  private readonly threshold: number;

  constructor(
    private readonly session: GlinerSession | undefined,
    options: GlinerRecognizerOptions = {},
  ) {
    this.labelMap = options.labelMap ?? DEFAULT_GLINER_LABEL_MAP;
    this.labels = options.labels ?? [...new Set(Object.keys(this.labelMap))];
    this.threshold = options.threshold ?? 0.5;
  }

  get available(): boolean {
    return this.session !== undefined;
  }

  async detect(text: string): Promise<RedactionEntity[]> {
    if (!this.session || text.length === 0) return [];
    let spans: GlinerSpan[];
    try {
      spans = await this.session.infer(text, this.labels);
    } catch {
      // Fail closed: an ML failure must never block a turn — regex still runs.
      return [];
    }
    const entities: RedactionEntity[] = [];
    for (const span of spans) {
      if (span.score < this.threshold) continue;
      if (span.start < 0 || span.end > text.length || span.start >= span.end) continue;
      const type = this.labelMap[span.label.trim().toLowerCase()];
      if (!type) continue;
      entities.push({ type, start: span.start, end: span.end, risk: riskFor(type), detector: "ml" });
    }
    return entities.sort((a, b) => a.start - b.start);
  }
}

export interface CreateGlinerRecognizerOptions extends GlinerRecognizerOptions {
  /** Path to a GLiNER ONNX model. Defaults to `process.env.FUTURE_GLINER_MODEL`. */
  modelPath?: string;
  /** Builds a session from a model path. Injectable for tests; defaults to the
   *  ONNX Runtime loader. */
  createSession?: (modelPath: string) => Promise<GlinerSession>;
}

/**
 * Builds a GLiNER recognizer when a model is configured, otherwise returns an
 * unavailable recognizer so redaction stays regex-only (as the spec permits).
 * Any load failure degrades to NO_ML rather than throwing.
 */
export async function createGlinerRecognizer(options: CreateGlinerRecognizerOptions = {}): Promise<GlinerRecognizer> {
  const modelPath = options.modelPath ?? process.env.FUTURE_GLINER_MODEL;
  if (!modelPath) return new GlinerRecognizer(undefined, options);
  try {
    const create = options.createSession ?? createOnnxGlinerSession;
    const session = await create(modelPath);
    return new GlinerRecognizer(session, options);
  } catch {
    return new GlinerRecognizer(undefined, options);
  }
}

/**
 * Loads a GLiNER ONNX model with `onnxruntime-node`, which is an **optional**
 * runtime dependency the user installs to enable ML recognition — it is not a
 * declared dependency, so the default build stays lean and CI-safe.
 *
 * GLiNER exports vary in their tokenizer and tensor layout, so the model's
 * encode/decode is supplied by a small adapter loaded alongside the model
 * (`<modelPath>.adapter.mjs`, exporting `encode` and `decode`). When either the
 * runtime or the adapter is missing this throws, and `createGlinerRecognizer`
 * falls back to NO_ML.
 */
export async function createOnnxGlinerSession(modelPath: string): Promise<GlinerSession> {
  // Variable specifiers keep the optional runtime out of static resolution, so
  // the package neither declares nor type-checks against onnxruntime-node.
  const runtimeSpecifier = "onnxruntime-node";
  const ort = (await import(/* @vite-ignore */ runtimeSpecifier)) as unknown as OnnxRuntimeModule;
  const adapter = (await import(/* @vite-ignore */ `${modelPath}.adapter.mjs`)) as unknown as GlinerModelAdapter;
  if (typeof adapter.encode !== "function" || typeof adapter.decode !== "function") {
    throw new Error("GLiNER adapter must export encode() and decode()");
  }
  const session = await ort.InferenceSession.create(modelPath);
  return {
    async infer(text, labels) {
      const feeds = adapter.encode(text, labels, ort.Tensor);
      const outputs = await session.run(feeds);
      return adapter.decode(outputs, text, labels);
    },
  };
}

interface OnnxRuntimeModule {
  InferenceSession: { create(path: string): Promise<{ run(feeds: unknown): Promise<unknown> }> };
  Tensor: unknown;
}

interface GlinerModelAdapter {
  encode(text: string, labels: string[], Tensor: unknown): unknown;
  decode(outputs: unknown, text: string, labels: string[]): GlinerSpan[];
}
