import { Section, Sub } from "@quanta/ui-kit/ui/section";
import { riskColor } from "@quanta/ui-kit/lib/risk";
import type { FolderData } from "./FolderInspectorView.mock";

export function FolderBlastPane({ d }: { d: FolderData }) {
  return (
    <>
      <Section label="Change blast">
        <div className="substats substats--3">
          <Sub k="Boundary crossings" v={String(d.blastBoundaryCrossings)} tone="warn" />
          <Sub k="Hot corridors" v={String(d.blastCorridors.length)} />
          <Sub k="Hotspot density" v={`${Math.round(d.hotspotDensity * 100)}%`} tone={d.hotspotDensity > 0.4 ? "warn" : "default"} />
        </div>
      </Section>

      <Section label="Top corridors" count={d.blastCorridors.length}>
        <ul className="folder-corridor">
          {d.blastCorridors.map((c) => (
            <li key={c.symbol} className="folder-corridor__row">
              <span className="folder-corridor__sym">{c.symbol}</span>
              <span className="folder-corridor__meta">→ {c.outFiles}f · {c.outFolders}d</span>
              <div className="folder-corridor__bar">
                <span className="folder-corridor__fill" style={{ width: `${Math.min(100, c.outFiles * 2)}%`, background: riskColor(c.risk) }} />
              </div>
              <span className="folder-corridor__val" style={{ color: riskColor(c.risk) }}>{c.risk}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
