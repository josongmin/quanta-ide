import { useFlowTrace } from "../model/useFlowTrace";

export function FlowTraceOverlay() {
  const { isActive, lines, deactivate } = useFlowTrace();
  if (!isActive || lines.length === 0) return null;

  return (
    <div className="flowtrace-banner">
      <div className="flowtrace-label">// DATA FLOW TRACE</div>
      <div className="flowtrace-path">
        {lines.map((l, i) => (
          <span key={l.lineNo} className="flowtrace-node">
            {i > 0 && <span className="flowtrace-arrow">→</span>}
            <span className={`flowtrace-tag flowtrace-${l.kind}`}>
              L{l.lineNo}
              <span className="flowtrace-kind">{l.kind}</span>
            </span>
          </span>
        ))}
      </div>
      <button type="button" className="flowtrace-close" onClick={deactivate} aria-label="Close trace">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  );
}
