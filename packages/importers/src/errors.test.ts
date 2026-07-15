import { describe, expect, it } from "vitest";
import { EMPTY_SOURCE_ERROR_CODE, ImportParseError } from "./errors";
import { parseMarkdownDocument } from "./markdown";
import { parseTextDocument } from "./text";

describe("empty source rejection", () => {
  const options = { title: "empty.md", sourceUri: "import://empty.md" };

  it("rejects an empty markdown document with the stable error code", () => {
    try {
      parseMarkdownDocument({ ...options, text: "" });
      throw new Error("expected parseMarkdownDocument to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ImportParseError);
      expect((error as ImportParseError).code).toBe(EMPTY_SOURCE_ERROR_CODE);
    }
  });

  it("rejects a whitespace-only text document", () => {
    expect(() => parseTextDocument({ ...options, text: "   \n\t  " })).toThrow(ImportParseError);
  });

  it("accepts a document with any readable content", () => {
    const result = parseMarkdownDocument({ ...options, text: "# Title" });
    expect(result.documents).toHaveLength(1);
  });
});
