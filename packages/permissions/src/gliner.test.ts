import { describe, expect, it } from "vitest";
import { createGlinerRecognizer, GlinerRecognizer, type GlinerSession, type GlinerSpan } from "./gliner";

function sessionOf(spans: GlinerSpan[]): GlinerSession {
  return { infer: async () => spans };
}

describe("GlinerRecognizer", () => {
  it("is unavailable and detects nothing without a session", async () => {
    const recognizer = new GlinerRecognizer(undefined);
    expect(recognizer.available).toBe(false);
    expect(await recognizer.detect("anything")).toEqual([]);
  });

  it("maps thresholded spans to typed, risk-tagged ML entities in order", async () => {
    const text = "email jane@x.com ssn 123-45-6789 name Jane"; // length 42
    const recognizer = new GlinerRecognizer(
      sessionOf([
        { label: "Social Security Number", start: 21, end: 32, score: 0.97 },
        { label: "email", start: 6, end: 16, score: 0.9 },
        { label: "person", start: 38, end: 42, score: 0.8 },
        { label: "email", start: 6, end: 16, score: 0.2 }, // below threshold
        { label: "unmapped_type", start: 0, end: 5, score: 0.99 }, // no mapping
      ]),
      { threshold: 0.5 },
    );

    const entities = await recognizer.detect(text);

    expect(entities).toEqual([
      { type: "email", start: 6, end: 16, risk: "low", detector: "ml" },
      { type: "ssn", start: 21, end: 32, risk: "high", detector: "ml" },
      { type: "person", start: 38, end: 42, risk: "low", detector: "ml" },
    ]);
  });

  it("drops spans with out-of-range or inverted offsets", async () => {
    const recognizer = new GlinerRecognizer(
      sessionOf([
        { label: "email", start: -1, end: 4, score: 1 },
        { label: "email", start: 3, end: 2, score: 1 },
        { label: "email", start: 0, end: 999, score: 1 },
      ]),
    );
    expect(await recognizer.detect("short")).toEqual([]);
  });

  it("fails closed when inference throws", async () => {
    const recognizer = new GlinerRecognizer({
      infer: async () => {
        throw new Error("onnx exploded");
      },
    });
    expect(recognizer.available).toBe(true);
    expect(await recognizer.detect("jane@x.com")).toEqual([]);
  });
});

describe("createGlinerRecognizer", () => {
  it("returns an unavailable recognizer when no model is configured", async () => {
    const recognizer = await createGlinerRecognizer({});
    expect(recognizer.available).toBe(false);
  });

  it("builds a recognizer from the injected session factory", async () => {
    const recognizer = await createGlinerRecognizer({
      modelPath: "/models/gliner.onnx",
      createSession: async () => sessionOf([{ label: "email", start: 0, end: 10, score: 1 }]),
    });
    expect(recognizer.available).toBe(true);
    expect(await recognizer.detect("jane@x.com")).toEqual([
      { type: "email", start: 0, end: 10, risk: "low", detector: "ml" },
    ]);
  });

  it("degrades to NO_ML when the session factory throws", async () => {
    const recognizer = await createGlinerRecognizer({
      modelPath: "/models/missing.onnx",
      createSession: async () => {
        throw new Error("model not found");
      },
    });
    expect(recognizer.available).toBe(false);
  });
});
