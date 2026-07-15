/**
 * Stable error code raised when a source contains no retrievable content
 * (an empty or whitespace-only file). Consumers persist this code verbatim so
 * the browser can render a deterministic, retry-independent explanation.
 */
export const EMPTY_SOURCE_ERROR_CODE = "empty_source" as const;

export type ImportParseErrorCode = typeof EMPTY_SOURCE_ERROR_CODE;

export class ImportParseError extends Error {
  constructor(
    readonly code: ImportParseErrorCode,
    message?: string,
  ) {
    super(message ?? code.replaceAll("_", " "));
    this.name = "ImportParseError";
  }
}

/** Throws {@link ImportParseError} when `text` has no non-whitespace content. */
export function assertNonEmptySource(text: string): void {
  if (text.trim().length === 0) {
    throw new ImportParseError(EMPTY_SOURCE_ERROR_CODE, "The file has no readable content to import.");
  }
}
