import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock the icon import so we don't pull the full icon tree.
// ---------------------------------------------------------------------------

vi.mock("../../ui/icons", () => ({
  IconChevron: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-icon" {...props} />
  ),
}));

import { Section, Sub } from "../section/Section";

// ---------------------------------------------------------------------------
// Tests — Section
// ---------------------------------------------------------------------------

describe("Section", () => {
  it("renders with label and children", () => {
    render(
      <Section label="Findings">
        <p>child content</p>
      </Section>,
    );
    expect(screen.getByText("Findings")).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("renders the count badge when count is provided", () => {
    render(
      <Section label="Issues" count={7}>
        <span />
      </Section>,
    );
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("does not render a count badge when count is undefined", () => {
    const { container } = render(
      <Section label="Clean">
        <span />
      </Section>,
    );
    const countEl = container.querySelector(".insp__section-count");
    expect(countEl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — Sub
// ---------------------------------------------------------------------------

describe("Sub", () => {
  it("renders k/v with default tone", () => {
    render(<Sub k="Coverage" v="82%" />);
    expect(screen.getByText("Coverage")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
  });

  it("applies tone class", () => {
    const { container } = render(<Sub k="Risk" v="High" tone="danger" />);
    const vEl = container.querySelector(".sub__v--danger");
    expect(vEl).toBeInTheDocument();
  });
});
