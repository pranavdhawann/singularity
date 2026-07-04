import { hashText } from "./hash";
import type { ImportParseResult } from "./types";

export interface ParseMarkdownOptions {
  title: string;
  sourceUri: string;
  text: string;
}

export function parseMarkdownDocument(options: ParseMarkdownOptions): ImportParseResult {
  return {
    documents: [
      {
        title: options.title,
        sourceUri: options.sourceUri,
        mediaType: "text/markdown",
        text: options.text,
        hash: hashText(options.text),
        metadata: {}
      }
    ]
  };
}
