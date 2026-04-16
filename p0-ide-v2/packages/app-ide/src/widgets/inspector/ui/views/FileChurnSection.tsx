import { Section, Sub } from "@quanta/ui-kit/ui/section";
import { Sparkline } from "@quanta/ui-kit/ui/icons";
import { churn } from "./FileInspectorView.mock";
import { trendIcon } from "./FileInspectorView.utils";

export function FileChurnSection() {
  return (
    <Section label="Churn hotspots">
      <div className="substats substats--3">
        <Sub k="Hotspots" v="9" />
        <Sub k="Rising" v="3" tone="warn" />
        <Sub k="Churn Δ" v="4850" />
      </div>
      <ul className="churn">
        {churn.map((c) => (
          <li key={c.file} className="churn__row">
            <span className="churn__file">{c.file}</span>
            <span className={`churn__trend churn__trend--${c.trend}`}>{trendIcon(c.trend)}</span>
            <span className="churn__count">{c.count}</span>
            <div className="churn__bar">
              <span className="churn__fill" style={{ width: `${Math.round(c.weight * 100)}%` }} />
            </div>
            <Sparkline points={c.spark} className="churn__spark" />
          </li>
        ))}
      </ul>
    </Section>
  );
}
