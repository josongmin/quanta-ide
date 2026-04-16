import { Section, Sub } from "@quanta/ui-kit/ui/section";
import { riskBarStyle, riskColor } from "@quanta/ui-kit/lib/risk";
import type { FolderData } from "./FolderInspectorView.mock";

export function FolderOwnershipPane({ d }: { d: FolderData }) {
  return (
    <>
      <Section label="Ownership health">
        <div className="substats substats--3">
          <Sub k="Bus factor" v={String(d.busFactor)} tone={d.busFactor <= 1 ? "danger" : "default"} />
          <Sub k="Orphaned" v={String(d.orphanedFiles)} tone={d.orphanedFiles > 0 ? "warn" : "default"} />
          <Sub k="Stale" v={String(d.staleFiles)} tone={d.staleFiles > 0 ? "warn" : "default"} />
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

      <Section label="Risk ownership">
        <ul className="folder-rown">
          {d.contributors.map((c) => (
            <li key={c.name} className="folder-rown__row">
              <span className="folder-rown__name">{c.name}</span>
              <div className="folder-rown__bar"><span className="folder-rown__fill" style={{ width: `${c.ownsRisk}%`, background: riskColor(c.ownsRisk) }} /></div>
              <span className="folder-rown__val">{c.ownsRisk}%</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
