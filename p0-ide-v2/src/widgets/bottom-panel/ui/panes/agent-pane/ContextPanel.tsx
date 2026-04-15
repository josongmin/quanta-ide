import { useState } from "react";
import { toast } from "@/shared/model/toast-store";
import { CTX_GLYPH, IDLE_THRESHOLD, contextItems } from "./agent-pane.mock";
import { fmt } from "./agent-pane.utils";
import { LogButton } from "./LogButton";

export function ContextPanel({ onOpenLog }: { onOpenLog: () => void }) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const visible = contextItems.filter((c) => !removed.has(c.name));
  const visibleIdle = visible.filter((c) => !c.pinned && (c.idleTurns ?? 0) >= IDLE_THRESHOLD);
  const visibleIdleTok = visibleIdle.reduce((a, c) => a + c.tokens, 0);
  const visibleUsed = visible.reduce((a, c) => a + c.tokens, 0);

  function reclaim() {
    const reclaimedNames = visibleIdle.map((c) => c.name);
    const totalReclaimed = visibleIdleTok;
    setRemoved((prev) => {
      const next = new Set(prev);
      for (const n of reclaimedNames) next.add(n);
      return next;
    });
    toast.success(
      `Reclaimed ${fmt(totalReclaimed)} tokens`,
      `${reclaimedNames.length} idle items unpinned · context window freed`,
      "context",
    );
  }

  return (
    <section className="agst-col agst-col--ctx">
      <div className="agst-col__h">
        <span className="agst-col__label">Context</span>
        <span className="agst-col__count">{visible.length}</span>
        <span className="agst-col__right">{fmt(visibleUsed)} tok</span>
        <LogButton label="Context" onClick={onOpenLog} />
      </div>
      {visibleIdle.length > 0 && (
        <button
          type="button"
          className="agst-advisor"
          aria-label="Unpin idle items"
          onClick={reclaim}
        >
          <span className="agst-advisor__badge">{visibleIdle.length} idle</span>
          <span className="agst-advisor__text">
            unpin to reclaim
          </span>
          <span className="agst-advisor__val">{fmt(visibleIdleTok)} tok</span>
          <span className="agst-advisor__arrow" aria-hidden>→</span>
        </button>
      )}
      <ul className="agst-ctx">
        {visible.map((c) => {
          const idle = (c.idleTurns ?? 0) >= IDLE_THRESHOLD && !c.pinned;
          return (
            <li key={c.name} className={`agst-ctx__row${idle ? " is-idle" : ""}`}>
              <span className="agst-ctx__pin" aria-hidden>{c.pinned ? "◆" : "·"}</span>
              <span className={`agst-ctx__kind agst-ctx__kind--${c.kind}`} aria-hidden>
                {CTX_GLYPH[c.kind]}
              </span>
              <span className="agst-ctx__name" title={c.name}>{c.name}</span>
              {idle && (
                <span className="agst-ctx__idle" title={`idle ${c.idleTurns} turns`}>
                  idle {c.idleTurns}t
                </span>
              )}
              <span className="agst-ctx__tok">{fmt(c.tokens)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
