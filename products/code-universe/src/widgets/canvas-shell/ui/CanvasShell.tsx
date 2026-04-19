import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  buildHierarchicalLayout,
  type HierarchicalLayout,
} from "@quanta/canvas-engine";
import { TierBreadcrumb, useTierSwitch } from "../../../features/tier-switch";
import { useEntityState } from "../../../entities/entity";
import { useWorkspaceGraph } from "../../../shared/api/graph-source";
import { CanvasViewport } from "./CanvasViewport";
import { HoverTooltip } from "./HoverTooltip";
import { DrillPath } from "./DrillPath";

// CanvasShell
// --------------------------------------------------------------------
// Top-level product widget. Composes:
//   - tier-switch HUD (breadcrumb)
//   - CanvasViewport (SVG viewport that renders entity rects per tier)
//   - an inspector strip showing the selected entity
//
// Layout is computed ONCE per tree from the engine — all tier views
// read from the same `rects` map, so zooming in/out is a camera
// reflow (~O(visible entities)) not a layout recompute.

const WHEEL_FACTOR = 1.08;
const KEY_FACTOR = 1.2;

export function CanvasShell(): ReactElement {
  const { tier, scale, zoomBy } = useTierSwitch();
  const tree = useEntityState(s => s.tree);
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const graph = useWorkspaceGraph();

  // Hierarchical layout is keyed on the tree identity. The store
  // emits a fresh tree on every graph swap, so this memo effectively
  // recomputes once per graph load.
  const layout = useMemo<HierarchicalLayout | null>(
    () => (tree ? buildHierarchicalLayout(tree) : null),
    [tree],
  );

  // Measured viewport size — feeds CanvasViewport's fit-to-content.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setViewportSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom — Ctrl/Cmd + wheel zooms through tiers; plain wheel
  // still bubbles out so pages that contain the canvas can scroll
  // normally. Attached natively (non-passive) because preventDefault
  // isn't honoured on passive wheel listeners.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR;
      zoomBy(factor);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomBy(KEY_FACTOR);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomBy(1 / KEY_FACTOR);
      }
    },
    [zoomBy],
  );
  const onSwallowReactWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    // No-op unless explicitly zooming; prevents noisy react-dev
    // warnings when the native listener is the authority.
    if (e.ctrlKey || e.metaKey) return;
  }, []);

  const selected = selectedId && tree ? tree.byId.get(selectedId) : null;

  return (
    <div
      data-product="code-universe"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
        background: "#f1f5f9",
      }}
    >
      <header
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "white",
        }}
      >
        <strong style={{ fontSize: 14 }}>Code Universe</strong>
        <TierBreadcrumb />
        <div style={{ marginLeft: 8 }}>
          <DrillPath />
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b7280" }}>
          <code>scale {scale.toFixed(3)}</code> · <code>{tier.visibleKind}</code>
        </span>
      </header>

      <div
        ref={viewportRef}
        role="region"
        aria-label="Code Universe viewport"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onWheel={onSwallowReactWheel}
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          outline: "none",
        }}
      >
        {tree && layout && graph ? (
          <CanvasViewport
            tree={tree}
            layout={layout}
            tier={tier}
            graph={graph}
            width={viewportSize.w}
            height={viewportSize.h}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            waiting for workspace graph…
          </div>
        )}
      </div>

      {selected && (
        <aside
          style={{
            padding: "8px 14px",
            borderTop: "1px solid #e5e7eb",
            background: "white",
            fontSize: 12,
            color: "#374151",
            display: "flex",
            gap: 16,
          }}
        >
          <div>
            <strong>{selected.name}</strong>{" "}
            <code style={{ color: "#9ca3af" }}>{selected.kind}</code>
          </div>
          <div style={{ color: "#6b7280" }}>{selected.path || "/"}</div>
          {selected.metrics?.loc !== undefined && (
            <div style={{ color: "#6b7280" }}>loc {selected.metrics.loc}</div>
          )}
          {selected.metrics?.riskScore !== undefined && (
            <div style={{ color: "#6b7280" }}>risk {selected.metrics.riskScore}</div>
          )}
        </aside>
      )}

      <HoverTooltip />
    </div>
  );
}
