import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getContextMap,
  type ContextEdge,
  type ContextEdgeKind,
} from "@quanta/app-ide/entities/bounded-context";
import { focusStore } from "@quanta/app-ide/stores/focus-store";

const KIND_LABEL: Record<ContextEdgeKind, string> = {
  "shared-kernel": "shared kernel",
  "customer-supplier": "customer/supplier",
  conformist: "conformist",
  "anti-corruption": "ACL",
  "open-host": "open-host",
  violation: "VIOLATION",
};

export function ContextPane({ file }: { file: FileFacts }) {
  const map = useMemo(() => getContextMap(file.name), [file.name]);
  const [hoverFrom, setHoverFrom] = useState<string | null>(null);
  const [hoverTo, setHoverTo] = useState<string | null>(null);

  const edgeMap = useMemo(() => {
    const m = new Map<string, ContextEdge>();
    map.edges.forEach((e) => m.set(`${e.from}→${e.to}`, e));
    return m;
  }, [map]);

  const violationCount = map.violations.length;
  const dangerCount = map.violations.filter((v) => v.severity === "danger").length;

  const ctxIds = map.contexts.map((c) => c.id);

  return (
    <div className="ctx-pane">
      <div className="ctx-head">
        <div className="ctx-head__stat">
          <div className="ctx-head__stat-v">{map.contexts.length}</div>
          <div className="ctx-head__stat-k">contexts</div>
        </div>
        <div className="ctx-head__stat">
          <div className="ctx-head__stat-v ctx-head__stat-v--bad">{violationCount}</div>
          <div className="ctx-head__stat-k">violations</div>
        </div>
        <div className="ctx-head__stat">
          <div className="ctx-head__stat-v ctx-head__stat-v--crit">{dangerCount}</div>
          <div className="ctx-head__stat-k">danger</div>
        </div>
      </div>

      <ContextRadial map={map} />

      <div className="ctx-matrix" role="table" aria-label="Context map matrix">
        <div className="ctx-matrix__head" role="row">
          <div className="ctx-matrix__corner" role="columnheader">from \ to</div>
          {ctxIds.map((id) => {
            const c = map.contexts.find((x) => x.id === id)!;
            return (
              <div key={id} role="columnheader" className="ctx-matrix__col-h">
                {c.name}
              </div>
            );
          })}
        </div>
        {ctxIds.map((from) => {
          const fromCtx = map.contexts.find((x) => x.id === from)!;
          return (
            <div
              key={from}
              role="row"
              className={`ctx-matrix__row${hoverFrom === from ? " is-hot" : ""}`}
              onMouseEnter={() => setHoverFrom(from)}
              onMouseLeave={() => setHoverFrom(null)}
            >
              <div role="rowheader" className="ctx-matrix__row-h">
                {fromCtx.name}
                <span className="ctx-matrix__row-sub">{fromCtx.owner}</span>
              </div>
              {ctxIds.map((to) => {
                if (from === to) {
                  return <div key={to} role="cell" className="ctx-matrix__cell ctx-matrix__cell--self" />;
                }
                const e = edgeMap.get(`${from}→${to}`);
                const isHot = hoverTo === to || hoverFrom === from;
                return (
                  <div
                    key={to}
                    role="cell"
                    className={`ctx-matrix__cell${e ? ` ctx-matrix__cell--${e.kind}` : ""}${isHot ? " is-hot" : ""}`}
                    title={e ? `${KIND_LABEL[e.kind]} · ${e.weight} edges` : "no edges"}
                    onMouseEnter={() => setHoverTo(to)}
                  >
                    {e && (
                      <>
                        <span className="ctx-matrix__cell-w">{e.weight}</span>
                        {e.kind === "violation" && <span className="ctx-matrix__cell-x">×</span>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {map.violations.length > 0 && (
        <section className="ctx-violations">
          <h3 className="ctx-violations__h">Violations · {map.violations.length}</h3>
          <ul>
            {map.violations.map((v) => (
              <li key={v.id} className={`ctx-violation ctx-violation--${v.severity}`}>
                <button
                  type="button"
                  className="ctx-violation__btn"
                  onClick={() => focusStore.jumpTo(v.line)}
                >
                  <div className="ctx-violation__head">
                    <span className="ctx-violation__from">{v.fromContext}</span>
                    <span className="ctx-violation__arrow">→</span>
                    <span className="ctx-violation__to">{v.toContext}</span>
                    <span className={`ctx-violation__sev ctx-violation__sev--${v.severity}`}>{v.severity}</span>
                  </div>
                  <div className="ctx-violation__sym">{v.symbol}</div>
                  <div className="ctx-violation__loc">{v.file}:{v.line}</div>
                  <div className="ctx-violation__reaches">reaches: <code>{v.reaches}</code></div>
                  <div className="ctx-violation__reason">{v.reason}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ContextRadial({ map }: { map: ReturnType<typeof getContextMap> }) {
  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const r = 130;

  const pos = useMemo(() => {
    const m: Record<string, { x: number; y: number; angle: number }> = {};
    const n = map.contexts.length;
    map.contexts.forEach((c, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      m[c.id] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, angle };
    });
    return m;
  }, [map, cx, cy, r]);

  return (
    <svg className="ctx-radial" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="bounded context graph">
      {map.edges.map((e, i) => {
        const a = pos[e.from];
        const b = pos[e.to];
        if (!a || !b) return null;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const cx2 = (mx - cx) * 0.4 + cx;
        const cy2 = (my - cy) * 0.4 + cy;
        const path = `M ${a.x} ${a.y} Q ${cx2} ${cy2} ${b.x} ${b.y}`;
        return (
          <path
            key={i}
            d={path}
            className={`ctx-radial__edge ctx-radial__edge--${e.kind}`}
            strokeWidth={1 + Math.log2(e.weight + 1)}
            fill="none"
          />
        );
      })}
      {map.contexts.map((c) => {
        const p = pos[c.id];
        return (
          <g key={c.id} transform={`translate(${p.x}, ${p.y})`}>
            <circle r={Math.max(14, Math.min(28, c.symbolCount / 8))} className="ctx-radial__node" />
            <text textAnchor="middle" y={4} className="ctx-radial__node-label">
              {c.name}
            </text>
            <text textAnchor="middle" y={Math.max(14, Math.min(28, c.symbolCount / 8)) + 14} className="ctx-radial__node-owner">
              {c.owner}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
