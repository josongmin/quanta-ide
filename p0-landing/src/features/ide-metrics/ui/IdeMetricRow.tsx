import { useTranslation } from "react-i18next";

export interface Metric {
  key: string;
  v: string;
  delta?: string;
}

interface IdeMetricRowProps {
  metrics: Metric[];
}

export function IdeMetricRow({ metrics }: IdeMetricRowProps) {
  const { t } = useTranslation();
  return (
    <div className="ide-metric-row">
      {metrics.map((m) => (
        <div key={m.key} className="ide-metric">
          <div className="ide-metric-k">{t(`ide.metrics.${m.key}`)}</div>
          <div className="ide-metric-v">
            {m.v}
            {m.delta && <span className="delta">{m.delta}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
