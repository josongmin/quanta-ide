import { useState } from "react";
import type { SymbolFacts } from "@quanta/app-ide/entities/symbol";

export function ContextSection({ info }: { info: SymbolFacts }) {
  const [open, setOpen] = useState(false);
  const incidentCount = info.relatedIncidents?.length ?? 0;
  const hotPath = info.hotPath;
  const summary: string[] = [];
  if (info.deps) {
    const inT = info.deps.incomingTotal ?? info.deps.incoming.length;
    const outT = info.deps.outgoingTotal ?? info.deps.outgoing.length;
    summary.push(`deps ${inT}/${outT}`);
  }
  if (hotPath) summary.push(`hot ${hotPath.rank}/${hotPath.total}`);
  if (info.lastRiskyChange) summary.push(`risky Δ ${info.lastRiskyChange.when}`);
  if (incidentCount > 0) summary.push(`inc ${incidentCount}`);

  return (
    <div className={`symtip__ctx${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="symtip__ctx-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="symtip__ctx-chev" aria-hidden>{open ? "▾" : "▸"}</span>
        <span className="symtip__ctx-label">context</span>
        <span className="symtip__ctx-summary">{summary.join(" · ")}</span>
      </button>
      {open && (
        <div className="symtip__ctx-body">
          {info.deps && (
            <div className="symtip__ctx-row">
              <span className="symtip__ctx-k">in / out</span>
              <div className="symtip__ctx-deps">
                <div className="symtip__ctx-dep-side">
                  <span className="symtip__ctx-dep-count">
                    {info.deps.incomingTotal ?? info.deps.incoming.length}
                  </span>
                  <span className="symtip__ctx-dep-arrow">→</span>
                  <span className="symtip__ctx-dep-names">
                    {info.deps.incoming.slice(0, 3).map((d) => d.name).join(", ")}
                    {info.deps.incoming.length > 3 && " …"}
                  </span>
                </div>
                <div className="symtip__ctx-dep-side">
                  <span className="symtip__ctx-dep-count">
                    {info.deps.outgoingTotal ?? info.deps.outgoing.length}
                  </span>
                  <span className="symtip__ctx-dep-arrow">←</span>
                  <span className="symtip__ctx-dep-names">
                    {info.deps.outgoing.slice(0, 3).map((d) => d.name).join(", ")}
                    {info.deps.outgoing.length > 3 && " …"}
                  </span>
                </div>
              </div>
            </div>
          )}
          {hotPath && (
            <div className="symtip__ctx-row">
              <span className="symtip__ctx-k">hot path</span>
              <div className="symtip__ctx-hot">
                <span className="symtip__ctx-hot-label">{hotPath.label}</span>
                <span className="symtip__ctx-hot-rank">#{hotPath.rank} / {hotPath.total}</span>
              </div>
            </div>
          )}
          {info.lastRiskyChange && (
            <div className="symtip__ctx-row">
              <span className="symtip__ctx-k">last risky</span>
              <div className="symtip__ctx-risky">
                <span className="symtip__ctx-risky-head">
                  <span className="symtip__ctx-risky-sha">{info.lastRiskyChange.sha}</span>
                  <span className="symtip__ctx-risky-risk">risk {info.lastRiskyChange.risk}</span>
                  <span className="symtip__ctx-risky-when">{info.lastRiskyChange.when}</span>
                </span>
                <span className="symtip__ctx-risky-summary">{info.lastRiskyChange.summary}</span>
                <span className="symtip__ctx-risky-author">{info.lastRiskyChange.author}</span>
              </div>
            </div>
          )}
          {info.relatedIncidents && info.relatedIncidents.length > 0 && (
            <div className="symtip__ctx-row">
              <span className="symtip__ctx-k">incidents</span>
              <ul className="symtip__ctx-inc">
                {info.relatedIncidents.slice(0, 3).map((inc) => (
                  <li key={inc.id} className="symtip__ctx-inc-row">
                    <span className="symtip__ctx-inc-id">{inc.id}</span>
                    <span className="symtip__ctx-inc-sim">
                      {Math.round(inc.similarity * 100)}%
                    </span>
                    <span className="symtip__ctx-inc-when">{inc.when}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
