import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// ---------------------------------------------------------------------------
// Mock stores used by CommandPalette
// ---------------------------------------------------------------------------

vi.mock("@quanta/shell/stores/feature-registry", () => ({
  featureRegistry: {
    get: () => ({ features: new Map(), events: [] }),
    subscribe: () => () => {},
    allCommands: () => [],
  },
  useFeatureRegistry: () => new Map(),
}));

vi.mock("@quanta/shell/stores/ui-bus", () => ({
  uiBus: {
    togglePalette: vi.fn(),
    get: () => ({ paletteOpen: true }),
    subscribe: () => () => {},
  },
  useUiBus: () => true, // paletteOpen = true
}));

// ---------------------------------------------------------------------------
// Import CommandPalette after mocks
// ---------------------------------------------------------------------------

import { CommandPalette } from "../command-palette/ui/CommandPalette";

describe("CommandPalette — a11y (axe-core)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has no a11y violations when open (empty results)", async () => {
    const { container } = render(
      <CommandPalette onClose={vi.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
