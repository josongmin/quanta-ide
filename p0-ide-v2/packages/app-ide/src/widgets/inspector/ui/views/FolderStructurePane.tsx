import { Section, Sub } from "@quanta/ui-kit/ui/section";
import { IconArrowIn, IconArrowOut } from "@quanta/ui-kit/ui/icons";
import { SEV_CLASS, type FolderData } from "./FolderInspectorView.mock";

export function FolderStructurePane({ d }: { d: FolderData }) {
  const exposureExcess = d.boundaryExports - d.boundaryUsedExternally;

  return (
    <>
      <Section label="Architectural integrity">
        <div className="substats substats--3">
          <Sub k="Violations" v={String(d.archViolations)} tone={d.archViolations > 0 ? "danger" : "default"} />
          <Sub k="Cycles" v={String(d.cycles)} tone={d.cycles > 0 ? "warn" : "default"} />
          <Sub k="Coupling" v={d.coupling.toFixed(2)} tone={d.coupling > 0.6 ? "warn" : "default"} />
        </div>
        <div className="rsig" style={{ marginTop: 8 }}>
          {d.archIssues.map((a, i) => (
            <div key={i} className={`rsig__row ${SEV_CLASS[a.sev]}`}>
              <span className="rsig__icon"><span className="folder-arch__kind">{a.kind === "cycle" ? "↻" : a.kind === "layer" ? "⇅" : "⊘"}</span></span>
              <div className="rsig__text">
                <span className="rsig__label">{a.rule}</span>
                <span className="rsig__detail">{a.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Import cycle" count={d.cycleEdges.length}>
        <ol className="folder-cycle">
          {d.cycleEdges.map((e, i) => (
            <li key={i} className="folder-cycle__row">
              <span className="folder-cycle__num">{i + 1}</span>
              <span className="folder-cycle__from">{e.from}</span>
              <span className="folder-cycle__arrow">→</span>
              <span className="folder-cycle__to">{e.to}</span>
              <span className="folder-cycle__via">{e.via}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section label="Boundary surface" count={d.boundaryExports}>
        <div className="substats substats--3">
          <Sub k="Exports" v={String(d.boundaryExports)} />
          <Sub k="Used externally" v={String(d.boundaryUsedExternally)} />
          <Sub k="Over-exposed" v={String(exposureExcess)} tone={exposureExcess > 10 ? "warn" : "default"} />
        </div>
        <ul className="folder-bound">
          {d.boundary.map((b) => (
            <li key={b.name} className="folder-bound__row">
              <span className="folder-bound__kind">{b.kind === "class" ? "C" : b.kind === "const" ? "k" : "ƒ"}</span>
              <span className="folder-bound__name">{b.name}</span>
              <span className="folder-bound__used">{b.usedBy}</span>
              {b.tag && <span className={`pill pill--conf-${b.tag === "unused" ? "high" : "med"}`}>{b.tag}</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Dependency direction">
        <div className="folder-dep">
          <div className="folder-dep__col">
            <div className="folder-dep__head"><IconArrowIn size={12} /> Inbound</div>
            {d.inbound.map((e) => (
              <div key={e.folder} className={"folder-dep__row" + (e.allowed ? "" : " is-bad")}>
                <span className="folder-dep__name">{e.folder}</span>
                <span className="folder-dep__bar"><span className="folder-dep__fill" style={{ width: `${Math.min(100, e.weight * 4)}%` }} /></span>
                <span className="folder-dep__val">{e.weight}</span>
              </div>
            ))}
          </div>
          <div className="folder-dep__col">
            <div className="folder-dep__head"><IconArrowOut size={12} /> Outbound</div>
            {d.outbound.map((e) => (
              <div key={e.folder} className={"folder-dep__row" + (e.allowed ? "" : " is-bad")}>
                <span className="folder-dep__name">{e.folder}</span>
                <span className="folder-dep__bar"><span className="folder-dep__fill" style={{ width: `${Math.min(100, e.weight * 4)}%` }} /></span>
                <span className="folder-dep__val">{e.weight}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
