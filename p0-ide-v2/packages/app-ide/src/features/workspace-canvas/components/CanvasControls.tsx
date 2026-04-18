interface Props {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

export function CanvasControls({ scale, onZoomIn, onZoomOut, onFit }: Props) {
  return (
    <div className="ws-controls">
      <button type="button" className="ws-controls__btn" onClick={onZoomIn} title="Zoom in">+</button>
      <button type="button" className="ws-controls__btn" onClick={onZoomOut} title="Zoom out">−</button>
      <button type="button" className="ws-controls__btn" onClick={onFit} title="Fit to view">⤢</button>
      <span className="ws-controls__scale">{Math.round(scale * 100)}%</span>
    </div>
  );
}
