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
