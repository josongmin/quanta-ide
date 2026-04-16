import { Section, Sub } from "@quanta/ui-kit/ui/section";
import { riskBarStyle, riskColor } from "@quanta/ui-kit/lib/risk";
import { Sparkline } from "@quanta/ui-kit/ui/icons";
import { SEV_CLASS, type FolderData } from "./FolderInspectorView.mock";

export function FolderOverviewPane({ name, d }: { name: string; d: FolderData }) {
  const archCol = d.archViolations > 0 ? "danger" : "default";
  const exposureExcess = d.boundaryExports - d.boundaryUsedExternally;

  return (
    <>
      <div className="insp__hero insp__hero--folder">
        <div className="hero__name" title={name}>{name}/</div>

        <div className="hero__stats hero__stats--scale">
          <div className="hero__stat">
            <span className="hero__stat-head">
              <span className="hero__stat-glyph">▾</span>
              <span className="hero__stat-val">{d.files}</span>
            </span>
            <span className="hero__stat-key">files</span>
          </div>
          <div className="hero__stat">
            <span className="hero__stat-head">
              <span className="hero__stat-glyph">▣</span>
              <span className="hero__stat-val">{d.subfolders}</span>
            </span>
            <span className="hero__stat-key">subfolders</span>
          </div>
          <div className="hero__stat">
            <span className="hero__stat-head">
              <span className="hero__stat-glyph">☰</span>
              <span className="hero__stat-val">{d.totalLoc.toLocaleString()}</span>
            </span>
            <span className="hero__stat-key">lines</span>
          </div>
        </div>

        <div className="substats substats--3">
          <Sub k="Avg risk" v={String(d.avgRisk)} tone={d.avgRisk >= 60 ? "danger" : d.avgRisk >= 40 ? "warn" : "default"} />
          <Sub k="Issues" v={String(d.issues)} tone={d.issues > 0 ? "warn" : "default"} />
          <Sub k="Coverage" v={`${d.coverage}%`} tone={d.coverage < 50 ? "warn" : "default"} />
        </div>

        <div className="substats substats--3">
          <Sub k="Arch violations" v={String(d.archViolations)} tone={archCol} />
          <Sub k="Boundary surface" v={`${d.boundaryUsedExternally}/${d.boundaryExports}`} tone={exposureExcess > 10 ? "warn" : "default"} />
          <Sub k="Cohesion" v={d.cohesion.toFixed(2)} tone={d.cohesion < 0.5 ? "warn" : "default"} />
        </div>

        <div className="hero__trend">
          <span className="hero__trend-key">Risk trend · 8w</span>
          <Sparkline points={d.spark} className="hero__trend-spark" />
          <span className="hero__trend-val" style={{ color: riskColor(d.avgRisk) }}>+17</span>
        </div>
      </div>

      <Section label="Engine signals" count={d.signals.length}>
        <div className="rsig">
          {d.signals.map((s, i) => (
            <div key={i} className={`rsig__row ${SEV_CLASS[s.sev]}`}>
              <span className="rsig__icon"><s.Icon size={14} /></span>
              <div className="rsig__text">
                <span className="rsig__label">{s.label}</span>
                <span className="rsig__detail">{s.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Top risk files" count={d.topFiles.length}>
        <div className="rheat">
          {d.topFiles.map((f) => (
            <div key={f.name} className="rheat__row">
              <span className="rheat__issues">{f.issues}</span>
              <span className="rheat__name">{f.name}</span>
              <div className="rheat__bar"><div className="rheat__fill" style={riskBarStyle(f.risk)} /></div>
              <span className="rheat__val">{f.risk}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Subfolders" count={d.subfoldersList.length}>
        <div className="rheat">
          {d.subfoldersList.map((s) => (
            <div key={s.name} className="rheat__row">
              <span className="rheat__issues">{s.files}</span>
              <span className="rheat__name">{s.name}</span>
              <div className="rheat__bar"><div className="rheat__fill" style={riskBarStyle(s.risk)} /></div>
              <span className="rheat__val">{s.risk}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
