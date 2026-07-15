import type { RedactionEntity, RedactionPolicy, RedactionResult } from "@future/core";
import type { MlRecognizer, RedactionEngine } from "./redaction-engine";
import { detectRegexEntities } from "./recognizers";

const NO_ML: MlRecognizer = { available: false, detect: async () => [] };

export class NodeRedactionEngine implements RedactionEngine {
  constructor(private readonly ml: MlRecognizer = NO_ML) {}

  async analyze(text: string, policy: RedactionPolicy = { useMl: false }): Promise<RedactionEntity[]> {
    const regex = detectRegexEntities(text);
    const ml = policy.useMl && this.ml.available ? await this.ml.detect(text) : [];
    return dedupe([...regex, ...ml]);
  }

  async redact(text: string, policy: RedactionPolicy = { useMl: false }): Promise<RedactionResult> {
    const entities = await this.analyze(text, policy);
    const counts: Record<string, number> = {};
    let redacted = "";
    let cursor = 0;
    for (const entity of entities) {
      if (entity.start < cursor) continue; // skip overlaps
      counts[entity.type] = (counts[entity.type] ?? 0) + 1;
      const label = `[${entity.type.toUpperCase()}_${counts[entity.type]}]`;
      redacted += text.slice(cursor, entity.start) + label;
      cursor = entity.end;
    }
    redacted += text.slice(cursor);
    return {
      redacted,
      entities,
      counts,
      hasHighRisk: entities.some((e) => e.risk === "high"),
      mlAvailable: this.ml.available,
    };
  }
}

function dedupe(entities: RedactionEntity[]): RedactionEntity[] {
  return entities
    .slice()
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((entity, index, all) => index === 0 || entity.start >= all[index - 1]!.end);
}
