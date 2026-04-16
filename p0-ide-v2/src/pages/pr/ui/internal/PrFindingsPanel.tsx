import { cn } from "@/shared/lib";
import { SEV_META, type Severity, type Finding } from "@/entities/pr";
import { IconCheck, IconMagic } from "../../lib/icons";

export function PrFindingsPanel({
  findings,
  openFindings,
  autofixable,
  applyFinding,
  applyAllAutofix,
}: {
  findings: Finding[];
  openFindings: Finding[];
  autofixable: Finding[];
  applyFinding: (id: number) => void;
  applyAllAutofix: () => void;
}) {
  return (
    <section className="pr-page__panel">
      <header className="pr-page__panel-head">
        <div className="pr-page__panel-title">
          p0 engine auto-review
        </div>
        <button type="button" className="pr-page__panel-cta" onClick={applyAllAutofix} disabled={autofixable.length === 0}>
          <IconMagic /> Fix {autofixable.length} in batch
        </button>
      </header>
      <div className="pr-page__sev-bar">
        {(["blocker", "high", "med", "low"] as Severity[]).map((s) => {
          const count = openFindings.filter((f) => f.sev === s).length;
          return (
            <span key={s} className={`pr-page__sev pr-page__sev--${s}`}>
              <span className="pr-page__sev-dot" />
              {SEV_META[s].label}
              <span className="pr-page__sev-n">{count}</span>
            </span>
          );
        })}
      </div>

      <div className="pr-page__findings">
        {findings.map((f) => (
          <article
            key={f.id}
            className={cn(`pr-page__finding pr-page__finding--${f.sev}`, f.applied && "is-applied")}
          >
            <header className="pr-page__finding-head">
              <span className={`pr-page__finding-sev pr-page__finding-sev--${f.sev}`}>
                {SEV_META[f.sev].label}
              </span>
              <span className="pr-page__finding-rule">{f.rule}</span>
            </header>
            <div className="pr-page__finding-title">{f.title}</div>
            <div className="pr-page__finding-loc">
              {f.path}:{f.line}
            </div>
            <p className="pr-page__finding-detail">{f.detail}</p>
            <footer className="pr-page__finding-foot">
              {f.applied ? (
                <span className="pr-page__finding-applied">
                  <IconCheck /> Applied
                </span>
              ) : f.autofix ? (
                <button
                  type="button"
                  className="pr-page__apply-btn"
                  onClick={() => applyFinding(f.id)}
                >
                  <IconMagic /> Auto-fix
                </button>
              ) : (
                <span className="pr-page__finding-noauto">Needs manual review</span>
              )}
              <button type="button" className="pr-page__finding-jump">Jump to file</button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
