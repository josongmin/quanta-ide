import { Section } from "@/shared/ui/section";
import { signals } from "./FileInspectorView.mock";

export function FileSignalsSection() {
  return (
    <Section label="Risk signals" count={signals.length}>
      <div className="rsig">
        {signals.map((s, i) => (
          <div key={i} className="rsig__row">
            <span className="rsig__icon"><s.Icon size={14} /></span>
            <div className="rsig__text">
              <span className="rsig__label">{s.label}</span>
              <span className="rsig__detail">{s.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
