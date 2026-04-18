import type { MeasurePhase, MeasureResult } from "../hooks/use-measure-mode";
import { useSceneStore } from "../store/scene-store";

// Floating card that narrates measure-mode state. We intentionally don't
// render a full modal — the goal is to stay out of the user's way while
// they still see the canvas + the highlighted shortest path.

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

interface Props {
  phase: MeasurePhase;
  measureA: string | null;
  measureB: string | null;
  result: MeasureResult | null;
  onReset: () => void;
}

export function MeasureOverlay({
  phase,
  measureA,
  measureB,
  result,
  onReset,
}: Props) {
  const graph = useSceneStore(s => s.graph);
  if (phase === "none") return null;

  const a = measureA && graph ? graph.files.find(f => f.id === measureA) : null;
  const b = measureB && graph ? graph.files.find(f => f.id === measureB) : null;

  return (
    <div className="ws-measure" role="dialog" aria-label="Measure">
      <div className="ws-measure__head">
        <span className="ws-measure__tag">measure</span>
        <span className="ws-measure__phase">
          {phase === "first-picked"
            ? "pick B (hold M, click second file)"
            : phase === "second-picked"
            ? "computing..."
            : "results"}
        </span>
        <button
          type="button"
          className="ws-measure__close"
          onClick={onReset}
          title="Esc to reset"
        >×</button>
      </div>

      <div className="ws-measure__pair">
        <span className="ws-measure__slot">
          <span className="ws-measure__slot-k">A</span>
          <span className="ws-measure__slot-v" title={measureA ?? undefined}>
            {a ? basename(a.id) : "—"}
          </span>
        </span>
        <span className="ws-measure__arrow">→</span>
        <span className="ws-measure__slot">
          <span className="ws-measure__slot-k">B</span>
          <span className="ws-measure__slot-v" title={measureB ?? undefined}>
            {b ? basename(b.id) : "—"}
          </span>
        </span>
      </div>

      {phase === "showing-results" && result && (
        <div className="ws-measure__grid">
          <span className="ws-measure__k">hops</span>
          <span className="ws-measure__v">
            {result.hopCount === null ? "unreachable" : result.hopCount}
          </span>
          <span className="ws-measure__k">shared deps</span>
          <span className="ws-measure__v">{result.sharedDeps}</span>
          <span className="ws-measure__k">direct edges</span>
          <span className="ws-measure__v">{result.directEdges}</span>
          <span className="ws-measure__k">layer dist.</span>
          <span className="ws-measure__v">{result.layerDistance}</span>
        </div>
      )}

      <div className="ws-measure__hint">
        hold M + click two files. Esc to clear.
      </div>
    </div>
  );
}
