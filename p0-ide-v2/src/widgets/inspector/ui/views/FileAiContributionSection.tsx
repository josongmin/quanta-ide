import { Section, Sub } from "@/shared/ui/section";
import { aiContribution } from "./FileInspectorView.mock";

export function FileAiContributionSection() {
  return (
    <Section label="AI contribution">
      <div className="substats substats--3">
        <Sub
          k="AI ratio"
          v={`${Math.round(aiContribution.aiRatio * 100)}%`}
          tone={aiContribution.aiRatio > 0.6 ? "warn" : "default"}
        />
        <Sub
          k="Reviewed"
          v={`${Math.round(aiContribution.reviewedRatio * 100)}%`}
          tone={aiContribution.reviewedRatio < 0.2 ? "danger" : "default"}
        />
        <Sub k="AI lines" v={String(aiContribution.aiLines)} />
      </div>

      <div className="aic-strip" aria-label="AI density by line range">
        <span className="aic-strip__label">lines</span>
        <div className="aic-strip__track">
          {aiContribution.bands.map((b) => {
            const start = b.start;
            const span = b.end - b.start;
            const total = aiContribution.bands[aiContribution.bands.length - 1].end;
            const leftPct = (start / total) * 100;
            const widthPct = (span / total) * 100;
            // Four discrete density tiers for visual coherence w/ cov/churn bars
            const tier =
              b.aiRatio >= 0.85 ? "vhi" :
              b.aiRatio >= 0.65 ? "hi" :
              b.aiRatio >= 0.45 ? "med" :
              "lo";
            return (
              <div
                key={b.start}
                className={`aic-strip__band aic-strip__band--${tier}`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                title={`L${b.start}–${b.end} · AI ${Math.round(b.aiRatio * 100)}% · reviewed ${Math.round(b.reviewed * 100)}%`}
              >
                <span className="aic-strip__band-val">{Math.round(b.aiRatio * 100)}%</span>
              </div>
            );
          })}
        </div>
        <span className="aic-strip__total">200</span>
      </div>

      <ul className="aic-auth">
        {aiContribution.authors.map((a) => (
          <li key={a.name} className={`aic-auth__row aic-auth__row--${a.kind}`}>
            <span className={`aic-auth__dot aic-auth__dot--${a.kind}`} aria-hidden />
            <span className="aic-auth__name">{a.name}</span>
            <div className="aic-auth__bar">
              <span className="aic-auth__fill" style={{ width: `${Math.round(a.ratio * 100)}%` }} />
            </div>
            <span className="aic-auth__val">{a.lines}</span>
          </li>
        ))}
      </ul>

      {aiContribution.reviewedRatio < 0.2 && (
        <div className="aic-warn">
          Only {Math.round(aiContribution.reviewedRatio * 100)}% of AI-generated lines have human review —
          consider a guarded-review pass before merging.
        </div>
      )}
    </Section>
  );
}
