interface Props {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  showEdges: boolean;
  edgeCount: number;
  onToggleEdges: () => void;
}

export function CanvasControls({
  scale,
  onZoomIn,
  onZoomOut,
  onFit,
  showEdges,
  edgeCount,
  onToggleEdges,
}: Props) {
  return (
    <div className="ws-controls">
      <button type="button" className="ws-controls__btn" onClick={onZoomIn} title="Zoom in">+</button>
      <button type="button" className="ws-controls__btn" onClick={onZoomOut} title="Zoom out">−</button>
      <button type="button" className="ws-controls__btn" onClick={onFit} title="Fit to view">⤢</button>
      <button
        type="button"
        className={`ws-controls__btn ws-controls__btn--toggle${showEdges ? " is-on" : ""}`}
        onClick={onToggleEdges}
        title={`${showEdges ? "Hide" : "Show"} edges (${edgeCount.toLocaleString()} visible)`}
        aria-pressed={showEdges}
      >
        {/* Connected-graph glyph */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="6" r="2" />
          <circle cx="19" cy="6" r="2" />
          <circle cx="12" cy="18" r="2" />
          <path d="M7 6h10M6 8l5 8M18 8l-5 8" />
        </svg>
      </button>
      <span className="ws-controls__scale">{Math.round(scale * 100)}%</span>
    </div>
  );
}
