import { useMemo } from "react";
import type { EdgeKind } from "@quanta/canvas-engine";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore, interactionStore } from "../store/interaction-store";
import { useViewportStore } from "../store/viewport-store";

// Plain-click-on-edge info popover. Prefers the user's click point (stored
// in interactionStore.selectedEdgePoint) as the anchor, falling back to the
// edge midpoint when the selection was made programmatically. Reading
// hoveredEdgeId is intentionally out of scope — that state already drives
// the PixiStage hover stroke; this popover reacts only to the sticky
// `selectedEdgeId` set by use-canvas-interactions.

const KIND_LABEL: Record<EdgeKind, string> = {
  import: "Import",
  call: "Call",
  reference: "Reference",
  cfg: "Control flow",
  inheritance: "Inheritance",
  "test-covers": "Test covers",
  clone: "Clone",
  dataflow: "Data flow",
  effect: "Side effect",
  pdg: "Program dependence",
  alias: "Alias",
  "feature-flag": "Feature flag",
  "taint-propagation": "Taint",
  sanitizer: "Sanitizer",
  race: "Race",
  cycle: "Cycle",
  finding: "Finding",
  contract: "Contract",
  "dead-edge": "Dead edge",
  "runtime-divergence": "Runtime divergence",
  blast: "Blast radius",
  impact: "Impact",
  diff: "Diff",
  dependency: "Dependency",
  witness: "Witness",
  cochange: "Co-change",
  "rename-pair": "Rename",
  "supply-chain": "Supply chain",
};

const KIND_DESC: Partial<Record<EdgeKind, string>> = {
  import: "Source imports target (module-level dependency).",
  call: "Source calls a function/method defined in target.",
  reference: "Source references a symbol in target.",
  inheritance: "Source inherits from target.",
  "test-covers": "Test exercises code paths in target.",
  dataflow: "Values flow from source to target.",
  "taint-propagation": "Untrusted data propagates source → target.",
  blast: "Changing source is predicted to affect target.",
  cochange: "Source and target are committed together historically.",
  "dead-edge": "Relation exists in analysis but is unreachable at runtime.",
};

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

export function EdgeInfoPopover() {
  const selectedEdgeId = useInteractionStore(s => s.viewState.selectedEdgeId);
  const selectedEdgePoint = useInteractionStore(s => s.selectedEdgePoint);
  const graph = useSceneStore(s => s.graph);
  const layout = useSceneStore(s => s.layout);
  const viewport = useViewportStore(s => s.viewport);

  const edge = useMemo(() => {
    if (!selectedEdgeId || !graph) return null;
    return graph.fileEdges.find(e => e.id === selectedEdgeId) ?? null;
  }, [selectedEdgeId, graph]);

  const fromFile = useMemo(() => {
    if (!edge || !graph) return null;
    return graph.files.find(f => f.id === edge.from) ?? null;
  }, [edge, graph]);

  const toFile = useMemo(() => {
    if (!edge || !graph) return null;
    return graph.files.find(f => f.id === edge.to) ?? null;
  }, [edge, graph]);

  const screen = useMemo(() => {
    if (!edge) return null;
    if (selectedEdgePoint) {
      return {
        x: selectedEdgePoint.worldX * viewport.scale + viewport.x,
        y: selectedEdgePoint.worldY * viewport.scale + viewport.y,
      };
    }
    if (!layout) return null;
    const a = layout.fileRects.get(edge.from);
    const b = layout.fileRects.get(edge.to);
    if (!a || !b) return null;
    const midWorldX = (a.x + a.w / 2 + b.x + b.w / 2) / 2;
    const midWorldY = (a.y + a.h / 2 + b.y + b.h / 2) / 2;
    return {
      x: midWorldX * viewport.scale + viewport.x,
      y: midWorldY * viewport.scale + viewport.y,
    };
  }, [edge, layout, viewport, selectedEdgePoint]);

  if (!edge || !fromFile || !toFile || !screen) return null;

  const POPOVER_W = 320;
  const POPOVER_EST_H = 140;
  const margin = 8;
  const containerW = viewport.width || 0;
  const containerH = viewport.height || 0;

  let x = screen.x - POPOVER_W / 2;
  if (x < margin) x = margin;
  if (x + POPOVER_W > containerW - margin) x = containerW - margin - POPOVER_W;
  let y = screen.y + 14;
  if (y + POPOVER_EST_H > containerH - margin) y = screen.y - POPOVER_EST_H - 14;
  if (y < margin) y = margin;

  const kindLabel = KIND_LABEL[edge.kind] ?? edge.kind;
  const kindDesc = KIND_DESC[edge.kind];

  return (
    <div
      role="dialog"
      aria-label={`Edge: ${kindLabel} ${basename(fromFile.id)} → ${basename(toFile.id)}`}
      className="ws-edge-info"
      style={{ position: "absolute", left: x, top: y, width: POPOVER_W, pointerEvents: "auto" }}
      data-canvas-opaque="true"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="ws-edge-info__head">
        <span className="ws-edge-info__kind">{kindLabel}</span>
        {edge.severity && (
          <span className={`ws-edge-info__sev ws-edge-info__sev--${edge.severity}`}>
            {edge.severity}
          </span>
        )}
        <button
          type="button"
          className="ws-edge-info__close"
          aria-label="Close"
          onClick={() => interactionStore.selectEdge(null)}
        >
          ×
        </button>
      </header>

      <div className="ws-edge-info__route">
        <span className="ws-edge-info__route-node" title={fromFile.id}>
          {basename(fromFile.id)}
        </span>
        <span className="ws-edge-info__route-arrow" aria-hidden>→</span>
        <span className="ws-edge-info__route-node" title={toFile.id}>
          {basename(toFile.id)}
        </span>
      </div>

      {kindDesc && <p className="ws-edge-info__desc">{kindDesc}</p>}

      <dl className="ws-edge-info__meta">
        <div>
          <dt>Layer</dt>
          <dd>{edge.layer}</dd>
        </div>
        <div>
          <dt>Weight</dt>
          <dd>{edge.weight.toFixed(2)}</dd>
        </div>
        {edge.confidence !== undefined && (
          <div>
            <dt>Confidence</dt>
            <dd>{(edge.confidence * 100).toFixed(0)}%</dd>
          </div>
        )}
        {edge.evidenceId && (
          <div>
            <dt>Evidence</dt>
            <dd className="ws-edge-info__evidence">
              <button
                type="button"
                onClick={() => interactionStore.setInspectedEvidence(edge.evidenceId!)}
              >
                open proof →
              </button>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
