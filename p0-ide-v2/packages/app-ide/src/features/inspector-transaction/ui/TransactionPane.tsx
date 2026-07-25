import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getTransactionMap,
  type TxBoundary,
  type TxKind,
  type TxStepKind,
} from "@quanta/app-ide/entities/transaction-boundary";
import { focusStore } from "@quanta/app-ide/stores/focus-store";

const KIND_LABEL: Record<TxKind, string> = {
  "db-tx": "DB tx",
  saga: "Saga",
  outbox: "Outbox",
  "two-phase": "2PC",
  "best-effort": "Best-effort",
};

const STEP_LABEL: Record<TxStepKind, string> = {
  "db-write": "DB write",
  "db-read": "DB read",
  "external-call": "External",
  "queue-publish": "Queue",
  "cache-write": "Cache",
  "in-memory": "Memory",
};

export function TransactionPane({ file }: { file: FileFacts }) {
  const map = useMemo(() => getTransactionMap(file.name), [file.name]);
  const [activeId, setActiveId] = useState(map.boundaries[0]?.id);
  const active = map.boundaries.find((b) => b.id === activeId) ?? map.boundaries[0];

  return (
    <div className="tx-pane">
      <ul className="tx-tabs" role="tablist">
        {map.boundaries.map((b) => {
          const danger = b.findings.some((f) => f.severity === "danger");
          return (
            <li key={b.id}>
              <button
                type="button"
                role="tab"
                aria-selected={b.id === active?.id}
                className={`tx-tabs__btn${b.id === active?.id ? " is-active" : ""}${danger ? " is-danger" : ""}`}
                onClick={() => setActiveId(b.id)}
              >
                <span className={`tx-tabs__kind tx-tabs__kind--${b.kind}`}>{KIND_LABEL[b.kind]}</span>
                <span className="tx-tabs__label">{b.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {active && <BoundaryDetail b={active} />}
    </div>
  );
}

function BoundaryDetail({ b }: { b: TxBoundary }) {
  const crossings = b.steps.filter((s) => s.crossesBoundary).length;
  return (
    <section className="tx-detail">
      <header className="tx-detail__h">
        <div>
          <span className={`tx-detail__kind tx-detail__kind--${b.kind}`}>{KIND_LABEL[b.kind]}</span>
          <h3 className="tx-detail__title">{b.label}</h3>
        </div>
        <div className="tx-detail__meta">
          {b.steps.length} steps · {crossings} crossings
        </div>
      </header>

      <div className="tx-box">
        <div className="tx-box__edge tx-box__edge--start">
          <span className="tx-box__edge-tag">begin</span>
          <button type="button" className="tx-box__edge-jump" onClick={() => focusStore.jumpTo(b.startLine)}>
            {b.startSymbol}
            <span className="tx-box__edge-loc">{b.startFile}:{b.startLine}</span>
          </button>
        </div>

        <div className="tx-box__interior" aria-label="atomic interior">
          <ol className="tx-steps">
            {b.steps.map((s) => (
              <li
                key={s.id}
                className={`tx-step tx-step--${s.kind}${s.crossesBoundary ? " is-crosses" : ""}`}
              >
                <span className={`tx-step__kind tx-step__kind--${s.kind}`}>{STEP_LABEL[s.kind]}</span>
                <button
                  type="button"
                  className="tx-step__sym"
                  onClick={() => focusStore.jumpTo(s.line)}
                >
                  {s.symbol}
                  <span className="tx-step__loc">{s.file}:{s.line}</span>
                </button>
                {s.crossesBoundary && (
                  <span className="tx-step__crossing" title="Step crosses the atomic boundary">⤴ crosses</span>
                )}
                {s.compensation && (
                  <span className="tx-step__comp">comp: {s.compensation}</span>
                )}
                {s.note && <div className="tx-step__note">{s.note}</div>}
              </li>
            ))}
          </ol>
        </div>

        <div className="tx-box__edge tx-box__edge--end">
          <span className="tx-box__edge-tag">commit</span>
          <button type="button" className="tx-box__edge-jump" onClick={() => focusStore.jumpTo(b.endLine)}>
            {b.endSymbol}
            <span className="tx-box__edge-loc">{b.endFile}:{b.endLine}</span>
          </button>
        </div>
      </div>

      {b.findings.length > 0 && (
        <ul className="tx-findings">
          {b.findings.map((f, i) => (
            <li key={i} className={`tx-finding tx-finding--${f.severity}`}>
              <span className="tx-finding__sev">{f.severity}</span>
              <span className="tx-finding__msg">{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
