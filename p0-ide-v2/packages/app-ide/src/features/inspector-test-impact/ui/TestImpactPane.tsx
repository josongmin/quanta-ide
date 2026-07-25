import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import { getTestImpactPlan, type TestConfidence } from "@quanta/app-ide/entities/test-impact";
import { focusStore } from "@quanta/app-ide/stores/focus-store";

const CONF_LABEL: Record<TestConfidence, string> = {
  high: "high",
  medium: "med",
  low: "low",
};

export function TestImpactPane({ file }: { file: FileFacts }) {
  const plan = useMemo(() => getTestImpactPlan(file.name), [file.name]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(plan.selected.map((t) => t.id)));

  const totalEst = useMemo(
    () => plan.selected.filter((t) => selectedIds.has(t.id)).reduce((s, t) => s + t.estMs, 0),
    [plan, selectedIds],
  );
  const reduction = Math.round((1 - totalEst / plan.fullSuiteMs) * 100);
  const selectedCases = plan.selected
    .filter((t) => selectedIds.has(t.id))
    .reduce((s, t) => s + (t.cases.includes("*") ? 50 : t.cases.length), 0);

  return (
    <div className="ti-pane">
      <header className="ti-head">
        <div className="ti-head__row">
          <div className="ti-head__stat">
            <div className="ti-head__stat-v">{plan.selected.length}</div>
            <div className="ti-head__stat-k">files</div>
          </div>
          <div className="ti-head__stat">
            <div className="ti-head__stat-v">{selectedCases}</div>
            <div className="ti-head__stat-k">cases</div>
          </div>
          <div className="ti-head__stat">
            <div className="ti-head__stat-v">{Math.round(totalEst / 1000)}<span>s</span></div>
            <div className="ti-head__stat-k">est runtime</div>
          </div>
          <div className="ti-head__stat">
            <div className={`ti-head__stat-v ti-head__stat-v--${reduction > 80 ? "ok" : reduction > 50 ? "warn" : "bad"}`}>{reduction}%</div>
            <div className="ti-head__stat-k">smaller than full</div>
          </div>
        </div>
        <div className="ti-head__base">base: <code>{plan.baseRef}</code> · full suite ≈ {Math.round(plan.fullSuiteMs / 1000)}s · {plan.totalTests} tests</div>
        {plan.fallbackToFull && (
          <div className="ti-head__warn">
            Plan empty — change touches build infra or unindexed files. Falling back to full suite.
          </div>
        )}
      </header>

      <section className="ti-block">
        <h3 className="ti-block__h">Changed files · {plan.changed.length}</h3>
        <ul className="ti-changed">
          {plan.changed.map((c) => (
            <li key={c.path} className="ti-changed__row">
              <span className="ti-changed__path">{c.path}</span>
              <span className="ti-changed__diff">
                <span className="ti-changed__add">+{c.added}</span>
                <span className="ti-changed__rm">−{c.removed}</span>
              </span>
              <span className={`ti-changed__dist ti-changed__dist--${c.testDistance === 0 ? "ok" : c.testDistance === 1 ? "warn" : "bad"}`}>
                d{c.testDistance}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ti-block">
        <h3 className="ti-block__h">Selected tests · {plan.selected.length}</h3>
        <ul className="ti-tests">
          {plan.selected.map((t) => {
            const checked = selectedIds.has(t.id);
            return (
              <li key={t.id} className={`ti-test ti-test--${t.confidence}${checked ? " is-checked" : ""}`}>
                <label className="ti-test__head">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (e.currentTarget.checked) next.add(t.id);
                        else next.delete(t.id);
                        return next;
                      })
                    }
                  />
                  <span className={`ti-test__conf ti-test__conf--${t.confidence}`}>{CONF_LABEL[t.confidence]}</span>
                  <button
                    type="button"
                    className="ti-test__path"
                    onClick={(e) => {
                      e.preventDefault();
                      focusStore.jumpTo(1);
                    }}
                  >
                    {t.path}
                  </button>
                  <span className="ti-test__dist">d{t.distance}</span>
                  <span className="ti-test__time">{(t.estMs / 1000).toFixed(1)}s</span>
                </label>
                <div className="ti-test__reason">{t.reason}</div>
                <ul className="ti-test__cases">
                  {t.cases.slice(0, 6).map((c) => (
                    <li key={c} className="ti-test__case">{c === "*" ? "all cases in file" : c}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="ti-foot">
        <div className="ti-foot__conf">
          Confidence in safe-subset:
          <span className={`ti-foot__conf-tag ti-foot__conf-tag--${plan.overallConfidence}`}>
            {CONF_LABEL[plan.overallConfidence]}
          </span>
        </div>
        <div className="ti-foot__cmd">
          <code>vitest run {plan.selected.filter((t) => selectedIds.has(t.id)).map((t) => t.path).join(" ")}</code>
        </div>
      </footer>
    </div>
  );
}
