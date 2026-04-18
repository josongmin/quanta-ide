import { memo } from "react";

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

export const CanvasControls = memo(function CanvasControls({ onZoomIn, onZoomOut, onFit }: Props) {
  return (
    <div className="canvas-controls">
      <button
        type="button"
        className="canvas-controls__btn"
        onClick={onZoomIn}
        aria-label="Zoom in"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className="canvas-controls__sep" />

      <button
        type="button"
        className="canvas-controls__btn"
        onClick={onZoomOut}
        aria-label="Zoom out"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className="canvas-controls__sep" />

      <button
        type="button"
        className="canvas-controls__btn"
        onClick={onFit}
        aria-label="Fit to view"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 8h4M8 6v4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
        </svg>
      </button>
    </div>
  );
});
