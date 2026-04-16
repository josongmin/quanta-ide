import { Section, Sub } from "@quanta/ui-kit/ui/section";
import { toast } from "@quanta/shell/stores/toast-store";
import { specRules } from "./FileInspectorView.mock";

export function FileSpecRulesSection() {
  return (
    <Section label="Discovered rules" count={specRules.length}>
      <div className="substats substats--2">
        <Sub k="Rules mined" v={String(specRules.length)} />
        <Sub
          k="Violations"
          v={String(specRules.filter((r) => r.violation).length)}
          tone={specRules.some((r) => r.violation) ? "danger" : "default"}
        />
      </div>
      <ul className="spec">
        {specRules.map((r) => (
          <li key={r.id} className={`spec__row${r.violation ? " has-violation" : ""}`}>
            <div className="spec__head">
              <span className={`spec__glyph${r.violation ? " is-violation" : ""}`} aria-hidden>
                {r.violation ? "!" : "◆"}
              </span>
              <span className="spec__rule">{r.rule}</span>
              <span className="spec__conf" title="Mining confidence">
                {r.confidence.toFixed(2)}
              </span>
            </div>
            <div className="spec__meta">
              <span className="spec__inst">{r.instances} instances</span>
              {r.violation && (
                <>
                  <span className="spec__sep">·</span>
                  <span className="spec__vio-label">VIOLATED</span>
                  <span className="spec__vio-sym">{r.violation.symbol}</span>
                  <span className="spec__vio-loc">{r.violation.loc}</span>
                </>
              )}
            </div>
            {r.violation && (
              <div className="spec__foot">
                <span className="spec__reason">{r.violation.reason}</span>
                <button
                  type="button"
                  className="spec__promote"
                  onClick={() => {
                    toast.success(
                      "Promoted to arch rule",
                      `"${r.rule}" now enforced across codebase (confidence ${r.confidence.toFixed(2)})`,
                      "arch rules",
                    );
                  }}
                >
                  Promote to arch rule →
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
