import { Section, Sub } from "@/shared/ui/section";
import { SEV_CLASS, type FolderData } from "./FolderInspectorView.mock";

export function FolderIncidentsPane({ d }: { d: FolderData }) {
  return (
    <>
      <Section label="Recurring patterns" count={d.incidents.length}>
        <ul className="folder-inc">
          {d.incidents.map((i) => (
            <li key={i.id} className={`folder-inc__row ${SEV_CLASS[i.severity]}`}>
              <span className="folder-inc__id">{i.id}</span>
              <div className="folder-inc__text">
                <span className="folder-inc__pat">{i.pattern}</span>
                <span className="folder-inc__meta">{i.date} · {i.matches} match{i.matches === 1 ? "" : "es"}</span>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Spec drift">
        <div className="substats substats--2">
          <Sub k="Drift" v={`${d.driftPct}%`} tone={d.driftPct > 20 ? "warn" : "default"} />
          <Sub k="Files affected" v="3" />
        </div>
      </Section>
    </>
  );
}
