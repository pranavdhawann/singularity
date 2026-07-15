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
