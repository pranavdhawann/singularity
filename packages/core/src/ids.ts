import { randomUUID } from "node:crypto";

export function createId(prefix: string): string {
  const random = randomUUID().replaceAll("-", "").slice(0, 24);
  return `${prefix}_${random}`;
}
