import { hashText } from "./hash";
import type { ImportParseResult } from "./types";

export interface ParseTextOptions {
  title: string;
  sourceUri: string;
  text: string;
}

export function parseTextDocument(options: ParseTextOptions): ImportParseResult {
  return {
    documents: [
      {
        title: options.title,
        sourceUri: options.sourceUri,
        mediaType: "text/plain",
        text: options.text,
        hash: hashText(options.text),
        metadata: {},
      },
    ],
  };
}
