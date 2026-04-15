import { REPO_DATA } from "./RepoInspectorView.mock";
import { ScoreRing, Stat } from "./RepoInspectorView.parts";

export function RepoInspectorHero({ name }: { name: string }) {
  const d = REPO_DATA;
  return (
    <div className="insp__hero insp__hero--repo">
      <div className="hero__name" title={name}>{name}</div>
      <div className="rii-header">
        <ScoreRing score={d.repoRisk} />
        <div className="rii-meta">
          <div className="rii-meta-row"><span className="rstat__label">FILES</span><span className="rii-meta-val">{d.analyzedFiles} / {d.totalFiles}</span></div>
          <div className="rii-meta-row"><span className="rstat__label">LOC</span><span className="rii-meta-val">{d.totalLoc.toLocaleString()}</span></div>
          <div className="rii-meta-row"><span className="rstat__label">AVG CPX</span><span className="rii-meta-val">{d.avgComplexity}</span></div>
          <div className="rii-meta-row"><span className="rstat__label">COVERAGE</span><span className="rii-meta-val">{d.testCoverage}%</span></div>
        </div>
      </div>

      <div className="rii-stats">
        <Stat label="TAINT" value={d.taintPaths} accent={d.taintPaths > 0} />
        <Stat label="DEAD" value={d.deadSymbols} accent={d.deadSymbols > 0} />
        <Stat label="BUS" value={d.busFactor} accent={d.busFactor <= 1} />
        <Stat label="BLAST" value={`×${d.blastHotspots}`} />
      </div>
    </div>
  );
}
