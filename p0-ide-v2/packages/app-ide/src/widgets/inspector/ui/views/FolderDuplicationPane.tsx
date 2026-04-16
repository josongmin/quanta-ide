import { Section, Sub } from "@quanta/ui-kit/ui/section";
import type { FolderData } from "./FolderInspectorView.mock";

export function FolderDuplicationPane({ d }: { d: FolderData }) {
  return (
    <>
      <Section label="Clone debt">
        <div className="substats substats--3">
          <Sub k="Clusters" v={String(d.clones.length)} />
          <Sub k="Duplicated" v={`${d.duplicationPct}%`} tone={d.duplicationPct > 15 ? "warn" : "default"} />
          <Sub k="Sites" v={String(d.clones.reduce((a, c) => a + c.size, 0))} />
        </div>
      </Section>

      <Section label="Clone clusters" count={d.clones.length}>
        <ul className="folder-clone">
          {d.clones.map((c) => (
            <li key={c.id} className="folder-clone__cluster">
              <div className="folder-clone__head">
                <span className="folder-clone__id">{c.id}</span>
                <span className="folder-clone__meta">{c.size} sites · {c.locs} loc</span>
                <span className="folder-clone__sim">sim {c.sim.toFixed(2)}</span>
              </div>
              <ul className="folder-clone__sites">
                {c.sites.map((s, i) => (
                  <li key={i} className="folder-clone__site">{s}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
