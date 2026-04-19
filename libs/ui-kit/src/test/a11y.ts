/**
 * Thin axe-core wrapper for Vitest accessibility scanning.
 *
 * Usage:
 *   import { axe, toHaveNoViolations } from "@quanta/ui-kit/test/a11y";
 *   expect.extend(toHaveNoViolations);
 *
 *   it("has no a11y violations", async () => {
 *     const { container } = render(<Component />);
 *     const results = await axe(container);
 *     expect(results).toHaveNoViolations();
 *   });
 */
export { axe, toHaveNoViolations } from "jest-axe";
