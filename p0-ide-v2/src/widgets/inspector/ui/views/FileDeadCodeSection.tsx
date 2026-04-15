import { Section, Sub } from "@/shared/ui/section";
import { deadCode } from "./FileInspectorView.mock";
import { symbolGlyph } from "./FileInspectorView.utils";

export function FileDeadCodeSection() {
  return (
    <Section label="Dead code">
      <div className="substats substats--2">
        <Sub k="Total" v={String(deadCode.length)} />
        <Sub k="High conf." v={String(deadCode.filter((d) => d.conf === "high").length)} />
      </div>
      <ul className="dead">
        {deadCode.map((d) => (
          <li key={d.name} className="dead__row">
            <span className="dead__glyph">{symbolGlyph(d.kind)}</span>
            <span className={"dead__name" + (d.strike ? " is-strike" : "")}>{d.name}</span>
            <span className="dead__loc">{d.loc}</span>
            <span className={`pill pill--conf-${d.conf}`}>{d.conf}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
