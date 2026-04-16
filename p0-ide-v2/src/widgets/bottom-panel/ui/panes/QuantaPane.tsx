import { useState } from "react";
import { quantaEvents, QUANTA_KINDS, type QuantaEventKind } from "@/entities/quanta";
import "./quanta-pane.css";

export function QuantaPane() {
  const [active, setActive] = useState<Set<QuantaEventKind>>(() => new Set(QUANTA_KINDS));

  const toggle = (k: QuantaEventKind) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const counts = quantaEvents.reduce<Record<string, number>>((acc, e) => {
    acc[e.kind] = (acc[e.kind] ?? 0) + 1;
    return acc;
  }, {});

  const visible = quantaEvents.filter((e) => active.has(e.kind));

  return (
    <div className="pane pane--quanta">
      <div className="pb-toolbar">
        <span className="pb-panel-title">Quanta</span>
        <span className="pb-toolbar-sep" aria-hidden />
        <div className="pb-toolbar-filters" role="group" aria-label="Event kinds">
          {QUANTA_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="switch"
              aria-checked={active.has(k)}
              className={`pb-chip pb-chip-${k}${active.has(k) ? " is-active" : ""}`}
              onClick={() => toggle(k)}
              title={`${k}: ${counts[k] ?? 0}`}
            >
              <span className="pb-chip-dot" aria-hidden />
              <span className="pb-chip-count">{counts[k] ?? 0}</span>
              <span className="pb-chip-label">{k}</span>
            </button>
          ))}
        </div>
        <div className="pb-toolbar-spacer" />
        <button type="button" className="pb-toolbar-action">Clear</button>
      </div>
      <ul className="q-list">
        {visible.map((e, i) => (
          <li key={i} className="q-row">
            <span className={`q-kind q-kind--${e.kind}`}>{e.kind}</span>
            <span className="q-ts">{e.ts}</span>
            <span className="q-msg">{e.msg}</span>
            {e.sym && <span className="q-sym">{e.sym}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
