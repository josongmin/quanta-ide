import { Section } from "@/shared/ui/section";
import { riskBarStyle } from "@/shared/lib/risk";
import { useFocusStore, type InspectorMode } from "@/shared/model/focus-store";
import { INSPECTOR_MODES } from "@/entities/inspector";
import { InspectorModeTabs } from "./InspectorModeTabs";
import { RepoInspectorHero } from "./RepoInspectorHero";
import { REPO_DATA, SEV_CLASS } from "./RepoInspectorView.mock";

export function RepoInspectorView({ name }: { name: string }) {
  const d = REPO_DATA;
  const mode = useFocusStore((s) => s.mode);

  return (
    <>
      <InspectorModeTabs
        counts={{
          flow: d.taintPaths,
          blast: d.blastHotspots,
          incidents: d.signals.filter((s) => s.severity === 3).length,
          ownership: d.authors.length,
        }}
      />

      {mode !== "overview" && (
        <div className="empty-pane">
          {modeLabel(mode)} view for repo is coming soon.
        </div>
      )}

      {mode === "overview" && (
      <>
      <RepoInspectorHero name={name} />

      <Section label="Risk signals" count={d.signals.length}>
        <div className="rsig">
          {d.signals.map((s, i) => (
            <div key={i} className={`rsig__row ${SEV_CLASS[s.severity]}`}>
              <span className="rsig__icon">{s.icon}</span>
              <div className="rsig__text">
                <span className="rsig__label">{s.label}</span>
                <span className="rsig__detail">{s.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="High-risk files" count={d.riskFiles.length}>
        <div className="rheat">
          {d.riskFiles.map((f) => (
            <div key={f.name} className="rheat__row">
              <span className="rheat__issues">{f.issues}</span>
              <span className="rheat__name">{f.name}</span>
              <div className="rheat__bar"><div className="rheat__fill" style={riskBarStyle(f.risk)} /></div>
              <span className="rheat__val">{f.risk}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Ownership risk" count={d.authors.length}>
        <div className="rown">
          {d.authors.map((a) => (
            <div key={a.name} className="rown__row">
              <span className="rown__avatar">{a.name[1]?.toUpperCase() ?? a.name[0]}</span>
              <span className="rown__name">{a.name}</span>
              <div className="rown__bar"><div className="rown__fill" style={riskBarStyle(a.riskOwned)} /></div>
              <span className="rown__pct">{a.riskOwned}%</span>
            </div>
          ))}
        </div>
      </Section>
      </>
      )}
    </>
  );
}

function modeLabel(mode: InspectorMode): string {
  const hit = INSPECTOR_MODES.find((x) => x.id === mode);
  return hit ? hit.label : "";
}
