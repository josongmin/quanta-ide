import { useEffect, type ReactNode } from "react";
import {
  DETAIL_TITLE,
  contextItems,
  ctxEvents,
  memEvents,
  meterEvents,
  todoEvents,
  type DetailKind,
} from "./agent-pane.mock";
import { fmt, parseTokDelta } from "./agent-pane.utils";

// ── Detail drawer ──────────────────────────────────────────────────────

export function DetailDrawer({ kind, onClose }: { kind: DetailKind; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="agst-drawer" role="dialog" aria-label={`${DETAIL_TITLE[kind]} log`}>
      <div className="agst-drawer__backdrop" onClick={onClose} aria-hidden />
      <aside className="agst-drawer__panel">
        <header className="agst-drawer__head">
          <span className="agst-drawer__breadcrumb">
            <button type="button" className="agst-drawer__back" onClick={onClose} aria-label="Back">
              ←
            </button>
            <span className="agst-drawer__crumb-from">Agent</span>
            <span className="agst-drawer__crumb-sep">/</span>
            <span className="agst-drawer__crumb-cur">{DETAIL_TITLE[kind]}</span>
          </span>
          <span className="agst-drawer__kicker">compressed log</span>
          <button type="button" className="agst-drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="agst-drawer__body">
          {kind === "meter" && <MeterLog />}
          {kind === "ctx"   && <CtxLog />}
          {kind === "mem"   && <MemLog />}
          {kind === "todo"  && <TodoLog />}
        </div>

        <footer className="agst-drawer__foot">
          <span>Esc to close</span>
        </footer>
      </aside>
    </div>
  );
}

function LogTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="agst-log">
      <div className="agst-log__head">{head}</div>
      <div className="agst-log__rows">{children}</div>
    </div>
  );
}

function MeterLog() {
  const totalIn   = meterEvents.reduce((a, e) => a + e.inDelta,   0);
  const totalCache = meterEvents.reduce((a, e) => a + e.cachedDelta, 0);
  const totalOut  = meterEvents.reduce((a, e) => a + e.outDelta,  0);
  const totalCost = meterEvents.reduce((a, e) => a + e.cost,      0);

  return (
    <>
      <div className="agst-log__summary">
        <SummaryStat k="events"   v={String(meterEvents.length)} />
        <SummaryStat k="input"    v={fmt(totalIn)} />
        <SummaryStat k="cached"   v={fmt(totalCache)} sub={`${Math.round((totalCache / totalIn) * 100)}%`} />
        <SummaryStat k="output"   v={fmt(totalOut)} />
        <SummaryStat k="cost"     v={`$${totalCost.toFixed(2)}`} />
      </div>
      <LogTable
        head={
          <div className="agst-log__row agst-log__row--head agst-log__row--meter">
            <span>t</span>
            <span>turn</span>
            <span>kind</span>
            <span className="agst-log__num">input</span>
            <span className="agst-log__num">cached</span>
            <span className="agst-log__num">output</span>
            <span className="agst-log__num">cost</span>
            <span>note</span>
          </div>
        }
      >
        {meterEvents.map((e, i) => (
          <div key={i} className="agst-log__row agst-log__row--meter">
            <span className="agst-log__t">{e.t}</span>
            <span className="agst-log__turn">t{e.turn}</span>
            <span className={`agst-log__verb agst-log__verb--${e.kind}`}>{e.kind}</span>
            <span className="agst-log__num">{e.inDelta > 0 ? `+${fmt(e.inDelta)}` : "—"}</span>
            <span className="agst-log__num agst-log__num--muted">{e.cachedDelta > 0 ? fmt(e.cachedDelta) : "—"}</span>
            <span className="agst-log__num">{e.outDelta > 0 ? `+${fmt(e.outDelta)}` : "—"}</span>
            <span className="agst-log__num">${e.cost.toFixed(3)}</span>
            <span className="agst-log__note">{e.note ?? ""}</span>
          </div>
        ))}
      </LogTable>
    </>
  );
}

function CtxLog() {
  const totalDelta = ctxEvents
    .map((e) => parseTokDelta(e.delta))
    .reduce((a, b) => a + b, 0);
  const pinCount = ctxEvents.filter((e) => e.action === "pin").length;

  return (
    <>
      <div className="agst-log__summary">
        <SummaryStat k="events"  v={String(ctxEvents.length)} />
        <SummaryStat k="tok in"  v={fmt(totalDelta)} />
        <SummaryStat k="files"   v={String(contextItems.filter((c) => c.kind === "file").length)} />
        <SummaryStat k="pins"    v={String(pinCount)} />
      </div>
      <LogTable
        head={
          <div className="agst-log__row agst-log__row--head agst-log__row--ctx">
            <span>t</span>
            <span>turn</span>
            <span>action</span>
            <span>resource</span>
            <span className="agst-log__num">delta</span>
            <span>note</span>
          </div>
        }
      >
        {ctxEvents.map((e, i) => (
          <div key={i} className="agst-log__row agst-log__row--ctx">
            <span className="agst-log__t">{e.t}</span>
            <span className="agst-log__turn">t{e.turn}</span>
            <span className={`agst-log__verb agst-log__verb--${e.action}`}>{e.action}</span>
            <span className="agst-log__res" title={e.resource}>{e.resource}</span>
            <span className="agst-log__num">{e.delta}</span>
            <span className="agst-log__note">{e.note ?? ""}</span>
          </div>
        ))}
      </LogTable>
    </>
  );
}

function MemLog() {
  const hits = memEvents.filter((e) => e.action === "hit" || e.action === "recall").length;
  const misses = memEvents.filter((e) => e.action === "miss").length;
  const injects = memEvents.filter((e) => e.action === "inject").length;

  return (
    <>
      <div className="agst-log__summary">
        <SummaryStat k="events"   v={String(memEvents.length)} />
        <SummaryStat k="recalls"  v={String(hits)} />
        <SummaryStat k="injects"  v={String(injects)} />
        <SummaryStat k="misses"   v={String(misses)} />
      </div>
      <LogTable
        head={
          <div className="agst-log__row agst-log__row--head agst-log__row--mem">
            <span>t</span>
            <span>turn</span>
            <span>action</span>
            <span>type</span>
            <span>name</span>
            <span>trigger</span>
          </div>
        }
      >
        {memEvents.map((e, i) => (
          <div key={i} className="agst-log__row agst-log__row--mem">
            <span className="agst-log__t">{e.t}</span>
            <span className="agst-log__turn">t{e.turn}</span>
            <span className={`agst-log__verb agst-log__verb--${e.action}`}>{e.action}</span>
            <span className={`agst-mem__type agst-mem__type--${e.type}`}>{e.type}</span>
            <span className="agst-log__res" title={e.name}>{e.name}</span>
            <span className="agst-log__note">{e.trigger ?? ""}</span>
          </div>
        ))}
      </LogTable>
    </>
  );
}

function TodoLog() {
  const created = todoEvents.filter((e) => e.action === "create").length;
  const started = todoEvents.filter((e) => e.action === "start").length;
  const done    = todoEvents.filter((e) => e.action === "done").length;

  return (
    <>
      <div className="agst-log__summary">
        <SummaryStat k="events"   v={String(todoEvents.length)} />
        <SummaryStat k="created"  v={String(created)} />
        <SummaryStat k="started"  v={String(started)} />
        <SummaryStat k="done"     v={String(done)} />
      </div>
      <LogTable
        head={
          <div className="agst-log__row agst-log__row--head agst-log__row--todo">
            <span>t</span>
            <span>turn</span>
            <span>action</span>
            <span>content</span>
            <span>source</span>
          </div>
        }
      >
        {todoEvents.map((e, i) => (
          <div key={i} className="agst-log__row agst-log__row--todo">
            <span className="agst-log__t">{e.t}</span>
            <span className="agst-log__turn">t{e.turn}</span>
            <span className={`agst-log__verb agst-log__verb--${e.action}`}>{e.action}</span>
            <span className="agst-log__res" title={e.content}>{e.content}</span>
            <span className="agst-log__note">{e.source ?? ""}</span>
          </div>
        ))}
      </LogTable>
    </>
  );
}

function SummaryStat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="agst-log__stat">
      <span className="agst-log__stat-k">{k}</span>
      <span className="agst-log__stat-v">
        {v}
        {sub && <span className="agst-log__stat-sub"> · {sub}</span>}
      </span>
    </div>
  );
}
