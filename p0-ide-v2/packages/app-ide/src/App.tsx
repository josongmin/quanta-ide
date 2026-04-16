import type { TabAppProps } from "@quanta/shell-contract";
import { IdePage } from "@/pages/ide";
import { useLayout } from "./layout-context";

/**
 * IDE tab application.
 *
 * Reads layout resize callbacks from LayoutContext (provided by Shell)
 * and forwards them to the existing IdePage component.
 *
 * Phase A: overlays (SimulateOverlay, ContextInjectOverlay, FirewallOverlay)
 * remain in the Shell for backward compatibility — they are shared across
 * all tabs and will migrate here in a later phase.
 */
export function IdeApp(_props: TabAppProps) {
  const layout = useLayout();

  return (
    <IdePage
      onResizeSidebar={layout.onResizeSidebar}
      onResizeInspector={layout.onResizeInspector}
      onResizeBottom={layout.onResizeBottom}
    />
  );
}
