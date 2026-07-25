import type { TabAppProps } from "@quanta/shell-contract";
import { TokenRadarDashboard } from "./ui/TokenRadarDashboard";

/**
 * TokenRadar — top-level tab.
 *
 * Standalone control-plane surface (NOT a Code Universe sub-mode and
 * NOT an IDE-inspector pane). Opens in its own tab with no surrounding
 * canvas / inspector — full width.
 */
export function TokenRadarApp(_props: TabAppProps) {
  return <TokenRadarDashboard />;
}
