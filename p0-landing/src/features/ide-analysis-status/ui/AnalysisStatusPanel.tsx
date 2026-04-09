import { useAnalysisStatus } from "../model/useAnalysisStatus";

export function AnalysisStatusPanel() {
  const { items, retry } = useAnalysisStatus();

  const hasAny = items.some((i) => i.state !== "done");
  if (!hasAny) return null;

  return (
    <div className="analysis-panel">
      <div className="analysis-label">// ANALYSIS STATUS</div>
      <div className="analysis-list">
        {items.map((item) => (
          <div key={item.id} className={`analysis-row analysis-${item.state}`}>
            <span className="analysis-indicator">
              {item.state === "done" && "✓"}
              {item.state === "loading" && "◐"}
              {item.state === "failed" && "✗"}
            </span>
            <span className="analysis-name">{item.label}</span>
            {item.state === "failed" && (
              <button
                type="button"
                className="analysis-retry"
                onClick={() => { retry(item.id); }}
              >
                retry
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
