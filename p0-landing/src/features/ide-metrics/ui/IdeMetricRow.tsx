export interface Metric {
  k: string;
  v: string;
  delta?: string;
}

interface IdeMetricRowProps {
  metrics: Metric[];
}

export function IdeMetricRow({ metrics }: IdeMetricRowProps) {
  return (
    <div className="ide-metric-row">
      {metrics.map((m) => (
        <div key={m.k} className="ide-metric">
          <div className="ide-metric-k">{m.k}</div>
          <div className="ide-metric-v">
            {m.v}
            {m.delta && <span className="delta">{m.delta}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
