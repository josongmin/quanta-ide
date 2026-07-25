import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import { getCveReach, type CveDep, type CveSeverity } from "@quanta/app-ide/entities/cve-reach";
import { focusStore } from "@quanta/app-ide/stores/focus-store";

const SEV_RANK: Record<CveSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const SEV_LABEL: Record<CveSeverity, string> = {
  critical: "CRIT",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

type Filter = "all" | "reachable" | "shadow";

export function CvePane({ file }: { file: FileFacts }) {
  const reach = useMemo(() => getCveReach(file.name), [file.name]);
  const [filter, setFilter] = useState<Filter>("reachable");
  const [activeId, setActiveId] = useState(reach.deps[0]?.id);

  const filtered = useMemo(() => {
    const f = reach.deps.filter((d) => {
      if (filter === "reachable") return d.paths.length > 0;
      if (filter === "shadow") return d.paths.length === 0;
      return true;
    });
    return [...f].sort((a, b) => {
      const ra = a.paths.length > 0 ? 1 : 0;
      const rb = b.paths.length > 0 ? 1 : 0;
      if (ra !== rb) return rb - ra;
      const sa = SEV_RANK[a.severity];
      const sb = SEV_RANK[b.severity];
      if (sa !== sb) return sb - sa;
      return b.cvss - a.cvss;
    });
  }, [reach, filter]);

  const reachable = reach.deps.filter((d) => d.paths.length > 0).length;
  const shadow = reach.deps.length - reachable;
  const critReachable = reach.deps.filter((d) => d.paths.length > 0 && d.severity === "critical").length;

  const active = filtered.find((d) => d.id === activeId) ?? filtered[0];

  return (
    <div className="cve-pane">
      <div className="cve-head">
        <div className="cve-head__stat">
          <div className="cve-head__stat-v cve-head__stat-v--bad">{reachable}</div>
          <div className="cve-head__stat-k">reachable</div>
        </div>
        <div className="cve-head__stat">
          <div className="cve-head__stat-v cve-head__stat-v--crit">{critReachable}</div>
          <div className="cve-head__stat-k">crit · live</div>
        </div>
        <div className="cve-head__stat">
          <div className="cve-head__stat-v cve-head__stat-v--mute">{shadow}</div>
          <div className="cve-head__stat-k">shadow only</div>
        </div>
        <div className="cve-head__filter" role="radiogroup" aria-label="filter">
          {(["reachable", "shadow", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              className={`cve-head__filter-btn${filter === f ? " is-active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <ul className="cve-list">
        {filtered.map((d) => {
          const live = d.paths.length > 0;
          return (
            <li key={d.id}>
              <button
                type="button"
                className={`cve-row cve-row--${d.severity}${live ? " is-live" : " is-shadow"}${d.id === active?.id ? " is-active" : ""}`}
                onClick={() => setActiveId(d.id)}
              >
                <span className={`cve-row__sev cve-row__sev--${d.severity}`}>{SEV_LABEL[d.severity]}</span>
                <span className="cve-row__cvss">{d.cvss.toFixed(1)}</span>
                <div className="cve-row__main">
                  <div className="cve-row__pkg">
                    <strong>{d.pkg}</strong>
                    <span className="cve-row__ver">{d.version}</span>
                    {d.fixedIn && <span className="cve-row__fix">fix → {d.fixedIn}</span>}
                  </div>
                  <div className="cve-row__sub">
                    <span className="cve-row__advisory">{d.advisoryId}</span>
                    <span className="cve-row__sym">{d.vulnSymbol}</span>
                  </div>
                </div>
                <div className="cve-row__reach">
                  {live ? (
                    <span className="cve-row__live">{d.paths.length} path{d.paths.length === 1 ? "" : "s"}</span>
                  ) : (
                    <span className="cve-row__shadow">unreachable</span>
                  )}
                  <span className="cve-row__imp">{d.importedBy} imp</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {active && <CveDetail dep={active} />}
    </div>
  );
}

function CveDetail({ dep }: { dep: CveDep }) {
  return (
    <section className="cve-detail">
      <header className="cve-detail__h">
        <h3 className="cve-detail__title">
          <code className="cve-detail__pkg">{dep.pkg}@{dep.version}</code>
          <span className={`cve-detail__sev cve-detail__sev--${dep.severity}`}>{SEV_LABEL[dep.severity]} · {dep.cvss.toFixed(1)}</span>
        </h3>
        <p className="cve-detail__summary">{dep.summary}</p>
        <div className="cve-detail__meta">
          <span>{dep.advisoryId}</span>
          {dep.fixedIn && <span>fix: <strong>{dep.fixedIn}</strong></span>}
          <span>scope: {dep.scope}</span>
        </div>
      </header>

      {dep.paths.length === 0 ? (
        <div className="cve-shadow-note">
          <div className="cve-shadow-note__title">No reachable call path</div>
          <p>
            Imported by <strong>{dep.importedBy}</strong> symbol{dep.importedBy === 1 ? "" : "s"} but no traced execution
            path reaches <code>{dep.vulnSymbol}</code>. Treat as <strong>shadow risk</strong>: still update the lockfile,
            but no production exploit path exists today.
          </p>
        </div>
      ) : (
        <div className="cve-paths">
          <h4 className="cve-paths__h">Reachable call paths · {dep.paths.length}</h4>
          {dep.paths.map((p, i) => (
            <div key={i} className={`cve-path${p.gated ? " is-gated" : ""}`}>
              <div className="cve-path__head">
                <span className="cve-path__depth">depth {p.depth}</span>
                {p.gated && (
                  <span className={`cve-path__gate cve-path__gate--${p.gated.kind}`}>
                    gated by {p.gated.kind}: <code>{p.gated.predicate}</code>
                  </span>
                )}
              </div>
              <ol className="cve-path__hops">
                {p.hops.map((h, j) => (
                  <li key={j} className={`cve-path__hop${j === p.hops.length - 1 ? " is-sink" : ""}`}>
                    <span className="cve-path__hop-step">{j + 1}</span>
                    <span className="cve-path__hop-sym">{h}</span>
                    {j < p.hops.length - 1 && <span className="cve-path__hop-arrow">→</span>}
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="cve-path__jump"
                onClick={() => focusStore.jumpTo(p.entryLine)}
              >
                jump to entry · {p.entryFile}:{p.entryLine}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
