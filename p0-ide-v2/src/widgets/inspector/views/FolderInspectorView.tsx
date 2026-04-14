import { Section, Sub, riskBarStyle } from "./shared";

interface FolderFile { name: string; risk: number; loc: number; issues: number; }
interface FolderSub { name: string; files: number; risk: number; }

const FOLDER_DATA = {
  files: 8,
  subfolders: 2,
  totalLoc: 2_140,
  avgRisk: 41,
  issues: 7,
  topFiles: [
    { name: "orchestrator.py", risk: 78, loc: 1974, issues: 5 },
    { name: "routing_policy.py", risk: 44, loc: 220, issues: 1 },
    { name: "base.py", risk: 18, loc: 96, issues: 0 },
    { name: "registry.py", risk: 12, loc: 84, issues: 0 },
    { name: "__init__.py", risk: 4, loc: 18, issues: 0 },
  ] as FolderFile[],
  subfoldersList: [
    { name: "tools/", files: 6, risk: 38 },
    { name: "plan_orchestration/", files: 4, risk: 24 },
  ] as FolderSub[],
  contributors: [
    { name: "@songmin", commits: 142, share: 0.62 },
    { name: "@carol", commits: 38, share: 0.21 },
    { name: "@devops-bot", commits: 24, share: 0.13 },
  ],
};

export function FolderInspectorView({ name }: { name: string }) {
  const d = FOLDER_DATA;

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
          <Sub k="Coverage" v="42%" tone="warn" />
        </div>
      </div>

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

      <Section label="Contributors" count={d.contributors.length}>
        <div className="rown">
          {d.contributors.map((c) => (
            <div key={c.name} className="rown__row">
              <span className="rown__avatar">{c.name[1]?.toUpperCase() ?? c.name[0]}</span>
              <span className="rown__name">{c.name}</span>
              <div className="rown__bar"><div className="rown__fill" style={riskBarStyle(Math.round(c.share * 100))} /></div>
              <span className="rown__pct">{c.commits}c</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
