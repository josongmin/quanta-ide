import type { TabAppProps } from "@quanta/shell-contract";
import { PrPage } from "@/pages/pr";

/**
 * PR review tab application.
 *
 * Phase A: thin wrapper around the existing PrPage.
 * PrPage is self-contained (owns its own sidebar, diff views, findings,
 * and review panels), so no additional context bridging is needed.
 */
export function PrApp(_props: TabAppProps) {
  return <PrPage />;
}
