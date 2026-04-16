import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { HoverAnchor } from "../model/symbol-hover";
import type { SymbolFacts } from "@quanta/app-ide/entities/symbol";

const KIND_LABEL: Record<string, string> = {
  class: "class",
  function: "function",
  method: "method",
  variable: "var",
  parameter: "param",
  module: "module",
};

const KIND_GLYPH: Record<string, string> = {
  class: "C",
  function: "ƒ",
  method: "m",
  variable: "v",
  parameter: "p",
  module: "M",
};

function riskTone(score: number): string {
  if (score >= 70) return "symtip__risk--high";
  if (score >= 40) return "symtip__risk--mid";
  return "";
}

function churnState(n: number): string {
  if (n > 10) return "churning";
  if (n > 3) return "active";
  return "stable";
}

interface Props {
  anchor: HoverAnchor;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onOpenFlow?: () => void;
  onJumpLine?: (line: number) => void;
}

const WIDTH = 340;
const OVERLAP = 3;

export function SymbolPopup({ anchor, onMouseEnter, onMouseLeave, onOpenFlow, onJumpLine }: Props) {
  const { info, rect } = anchor;
  const [pos, setPos] = useState<CSSProperties>(() => computePos(rect));

  useEffect(() => {
    setPos(computePos(rect));
  }, [rect]);

  const hasImpact = info.blast !== undefined;
  const hasShape = info.callers !== undefined || info.callees !== undefined;
  const hasMetrics =
    info.complexity !== undefined || info.tests || info.heat || info.dead;
  const hasChurn = info.churn90d !== undefined || info.blame;
  const hasContext =
    info.deps !== undefined ||
    info.hotPath !== undefined ||
    info.lastRiskyChange !== undefined ||
    (info.relatedIncidents && info.relatedIncidents.length > 0);

  return (
    <div
      className="symtip"
      style={pos}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="symtip__head">
        <span className="symtip__glyph">{KIND_GLYPH[info.kind] ?? "?"}</span>
        <span className="symtip__name">{info.name}</span>
        <span className="symtip__kind">{KIND_LABEL[info.kind] ?? info.kind}</span>
        {info.layer && <span className="symtip__layer">{info.layer}</span>}
        <div className="symtip__head-right">
          {info.line > 0 && <span className="symtip__loc">L{info.line}</span>}
          {info.riskScore !== undefined && info.riskScore > 0 && (
            <span className={`symtip__risk ${riskTone(info.riskScore)}`}>
              {info.riskScore}
            </span>
          )}
        </div>
      </div>

      {info.contract && (
        <div className="symtip__contract">
          <span className="symtip__contract-verb">{info.contract.verb}</span>
          <span className="symtip__contract-name">{info.contract.name}</span>
        </div>
      )}

      {info.detail && <div className="symtip__detail">{info.detail}</div>}

      {info.why && (
        <div className="symtip__why" title={info.why.href ?? info.why.label}>
          <span className="symtip__why-mark">↳ why</span>
          <span className="symtip__why-label">{info.why.label}</span>
        </div>
      )}

      {info.taint && (
        <div className={`symtip__taint symtip__taint--${info.taint}`}>
          taint · {info.taint}
        </div>
      )}

      {info.flowsTo && info.flowsTo.length > 0 && (
        <div className="symtip__flow">
          <div className="symtip__flow-head">
            <span>flow</span>
            {onOpenFlow && (
              <button type="button" className="symtip__flow-more" onClick={onOpenFlow}>
                trace →
              </button>
            )}
          </div>
          <ol className="symtip__flow-steps">
            {info.flowsTo.slice(0, 4).map((s, i) => (
              <li key={i} className="symtip__flow-step">
                <button
                  type="button"
                  className="symtip__flow-line"
                  onClick={() => onJumpLine?.(s.line)}
                  title={`Jump to line ${s.line}`}
                >
                  L{s.line}
                </button>
                <span className="symtip__flow-hop">{s.hop}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(hasImpact || hasShape) && (
        <div className="symtip__struct">
          {hasImpact && (
            <div className="symtip__struct-row">
              <span className="symtip__struct-label">impact</span>
              <ImpactBar blast={info.blast!} critical={info.blastCritical ?? 0} />
              <span className="symtip__struct-val">
                {info.blast}
                {info.blastCritical ? (
                  <span className="symtip__struct-val-sub"> · {info.blastCritical} crit</span>
                ) : null}
              </span>
            </div>
          )}
          {hasShape && (
            <div className="symtip__struct-row">
              <span className="symtip__struct-label">shape</span>
              <ShapeBar callers={info.callers ?? 0} callees={info.callees ?? 0} />
              {info.stability !== undefined && (
                <span className="symtip__struct-val" title="Martin instability · Ce/(Ca+Ce)">
                  I {info.stability.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {hasMetrics && (
        <div className="symtip__metrics">
          {info.complexity !== undefined && (
            <span className="symtip__chip">
              cpx {info.complexity}
              {info.bigO && <span className="symtip__chip-sub"> · {info.bigO}</span>}
            </span>
          )}
          {info.tests && (
            <span
              className={`symtip__chip${info.tests.startsWith("0/") && info.tests !== "0/0" ? " is-bad" : ""}`}
            >
              tests {info.tests}
            </span>
          )}
          {info.heat && (
            <span className={`symtip__chip symtip__chip--heat-${info.heat.level}`}>
              {info.heat.level}
              {info.heat.rate && <span className="symtip__chip-sub"> · {info.heat.rate}</span>}
            </span>
          )}
          {info.dead && <span className="symtip__chip is-muted">dead</span>}
        </div>
      )}

      {info.tags && info.tags.length > 0 && (
        <div className="symtip__tags">
          {info.tags.map((t) => (
            <span key={t} className="symtip__tag">{t}</span>
          ))}
        </div>
      )}

      {info.incidentMatch && (
        <div className="symtip__incident">
          <span className="symtip__incident-mark">!</span>
          <span className="symtip__incident-body">
            matches <span className="symtip__incident-id">{info.incidentMatch.id}</span>
            <span className="symtip__incident-sim">
              {Math.round(info.incidentMatch.similarity * 100)}%
            </span>
            <span className="symtip__incident-reason">{info.incidentMatch.reason}</span>
          </span>
        </div>
      )}

      {hasChurn && (
        <div className="symtip__churn">
          {info.churn90d !== undefined && (
            <span className={`symtip__churn-state symtip__churn-state--${churnState(info.churn90d)}`}>
              {churnState(info.churn90d)}
            </span>
          )}
          {info.blame && (
            <>
              <span className="symtip__sep">·</span>
              <span className="symtip__churn-when">{info.blame.when}</span>
            </>
          )}
          {info.churn90d !== undefined && (
            <>
              <span className="symtip__sep">·</span>
              <span className="symtip__churn-count">{info.churn90d} commits / 90d</span>
            </>
          )}
        </div>
      )}

      {hasContext && <ContextSection info={info} />}

      <div className="symtip__foot">
        <span><span className="symtip__kbd">⏎</span>open</span>
        <span><span className="symtip__kbd">⌘↵</span>impact</span>
        <span><span className="symtip__kbd">⌘E</span>ask agent</span>
      </div>
    </div>
  );
}

function ContextSection({ info }: { info: SymbolFacts }) {
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

function ImpactBar({ blast, critical }: { blast: number; critical: number }) {
  const SCALE = 50;
  const pct = Math.min(100, (blast / SCALE) * 100);
  const critPct = Math.min(pct, (critical / SCALE) * 100);
  return (
    <div className="symtip__impact-bar">
      <div className="symtip__impact-fill" style={{ width: `${pct}%` }} />
      {critical > 0 && (
        <div className="symtip__impact-crit-fill" style={{ width: `${critPct}%` }} />
      )}
    </div>
  );
}

function ShapeBar({ callers, callees }: { callers: number; callees: number }) {
  const max = Math.max(callers, callees, 1);
  const inW = (callers / max) * 100;
  const outW = (callees / max) * 100;
  return (
    <div className="symtip__shape-bar">
      <div className="symtip__shape-side symtip__shape-in">
        <span className="symtip__shape-num">{callers}</span>
        <div
          className="symtip__shape-fill symtip__shape-fill--in"
          style={{ width: `${inW}%` }}
        />
      </div>
      <div className="symtip__shape-core" />
      <div className="symtip__shape-side symtip__shape-out">
        <div
          className="symtip__shape-fill symtip__shape-fill--out"
          style={{ width: `${outW}%` }}
        />
        <span className="symtip__shape-num">{callees}</span>
      </div>
    </div>
  );
}

function computePos(rect: HoverAnchor["rect"]): CSSProperties {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const estH = 380;
  const below = rect.bottom + estH + 8 < vh;
  const top = below ? rect.bottom - OVERLAP : rect.top - estH + OVERLAP;
  let left = rect.left;
  if (left + WIDTH + 8 > vw) left = vw - WIDTH - 8;
  if (left < 8) left = 8;
  return {
    position: "fixed",
    top: Math.max(8, top),
    left,
    width: WIDTH,
    zIndex: 1000,
  };
}
