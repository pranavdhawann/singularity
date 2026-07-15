import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RedactionBadge } from "./RedactionBadge";

afterEach(cleanup);

describe("RedactionBadge", () => {
  it("summarizes total redactions and reveals typed counts on click", () => {
    render(<RedactionBadge counts={{ email: 2, credit_card: 1 }} />);
    expect(screen.getByRole("button", { name: /3 items redacted/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/email: 2/)).toBeInTheDocument();
    expect(screen.getByText(/credit_card: 1/)).toBeInTheDocument();
  });

  it("renders nothing when no redactions occurred", () => {
    const { container } = render(<RedactionBadge counts={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
