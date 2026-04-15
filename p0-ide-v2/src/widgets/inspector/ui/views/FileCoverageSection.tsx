import { Section, Sub } from "@/shared/ui/section";
import { coverage, coverageRows } from "./FileInspectorView.mock";

export function FileCoverageSection() {
  return (
    <Section label="Coverage gap">
      <div className="substats substats--3">
        <Sub k="Coverage" v={`${coverage.pct}%`} tone={coverage.pct < 50 ? "danger" : "default"} />
        <Sub k="Uncovered" v={String(coverage.uncovered)} />
        <Sub k="Files" v={String(coverage.files)} />
      </div>
      <ul className="cov">
        {coverageRows.map((r) => (
          <li key={r.file} className="cov__row">
            <span className="cov__file">{r.file}</span>
            <span className="cov__frac">{r.covered}/{r.total}</span>
            <div className="cov__bar">
              <span className="cov__fill" style={{ width: `${(r.covered / r.total) * 100}%`, background: "var(--success)" }} />
            </div>
            <span className="cov__delta">{r.delta > 0 ? `+${r.delta}` : r.delta}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
