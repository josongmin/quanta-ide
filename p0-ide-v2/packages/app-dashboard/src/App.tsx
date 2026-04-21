import { useLayoutEffect, useRef, useState } from "react";
import type { TabAppProps } from "@quanta/shell-contract";
import { DashboardView, useWorkspaceGraph } from "@quanta/code-universe";
import { uiBus } from "@quanta/shell/stores/ui-bus";

// Dashboard surface — peer to Settings. Rendered as a shell overlay
// when `uiBus.dashboardOpen` is true, or as a tab when opened via
// the registry. Either way the page consumes the workspace graph
// published by Code Universe's graph-source (same singleton the
// canvas reads).
//
// Visual language follows Settings (hero + flat surfaces, uppercase
// captions, dashed section borders) + Inspector (MetricCard 2-col
// grid, pills, relationRow). The aggregator view itself lives inside
// code-universe so it stays colocated with its compute-* builders;
// this wrapper just owns the shell integration seam.

export function DashboardApp(_props: TabAppProps) {
  const graph = useWorkspaceGraph();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 1200, h: 800 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onDismiss = (): void => {
    uiBus.toggleDashboard(false);
  };

  if (!graph) {
    return (
      <div
        ref={ref}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-subtle)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--fs-md)",
          fontStyle: "italic",
        }}
      >
        Waiting for workspace graph — open a Code Universe tab to populate the dashboard.
      </div>
    );
  }

  return (
    <div ref={ref} style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <DashboardView
        graph={graph}
        width={size.w}
        height={size.h}
        onDismiss={onDismiss}
      />
    </div>
  );
}
