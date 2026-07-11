import { describe, expect, it } from "vitest";
import { apiError } from "./api";

describe("apiError", () => {
  it("creates the stable V2 error envelope", () => {
    expect(
      apiError("validation_error", "Invalid request", "req_1", { name: "required" })
    ).toEqual({
      error: {
        code: "validation_error",
        message: "Invalid request",
        requestId: "req_1",
        details: { name: "required" }
      }
    });
  });

  it("preserves optimistic conflict details", () => {
    expect(apiError("conflict", "Memory changed", "req_2", { expectedVersion: 2 })).toEqual({
      error: {
        code: "conflict",
        message: "Memory changed",
        requestId: "req_2",
        details: { expectedVersion: 2 }
      }
    });
  });
});
