import { Section } from "@/shared/ui/section";
import { suggestion } from "./FileInspectorView.mock";

export function FileFixSection({ onOpenDetails }: { onOpenDetails: () => void }) {
  return (
    <Section label="Suggested fix">
      <div className="fix">
        <div className="fix__title">{suggestion.title}</div>
        <pre className="fix__code">{suggestion.diff}</pre>
        <div className="fix__meta">
          <div><span>Risk</span><b>{suggestion.riskBefore} → {suggestion.riskAfter}</b></div>
          <div><span>Confidence</span><b>{suggestion.confidence.toFixed(2)}</b></div>
          <div><span>Affects</span><b>5 files</b></div>
        </div>
        <div className="fix__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onOpenDetails}
          >
            View details
          </button>
          <button type="button" className="btn btn--ghost">Dismiss <kbd>Esc</kbd></button>
          <button type="button" className="btn btn--primary">Apply <kbd>Enter</kbd></button>
        </div>
      </div>
    </Section>
  );
}
