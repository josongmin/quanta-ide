import type { FileFacts, TaintPath } from "@/entities/engine";
import { focusStore, useFocusStore } from "@/entities/engine";

interface Props {
  file: FileFacts;
}

const HOP_COLOR: Record<TaintPath["steps"][number]["hop"], string> = {
  source: "var(--warn)",
  propagate: "var(--fg-muted)",
  branch: "var(--accent)",
  sink: "var(--danger)",
};

export function FlowPane({ file }: Props) {
  const activeId = useFocusStore((s) => s.flowPathId);
  const active = file.taintPaths.find((p) => p.id === activeId) ?? file.taintPaths[0];
  if (!active) return <EmptyPane label="No taint paths detected" />;

  return (
    <div className="flow-pane">
      <div className="flow-pane__tabs" role="tablist">
        {file.taintPaths.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === active.id}
            className={`flow-pane__tab${p.id === active.id ? " is-active" : ""}`}
            onClick={() => focusStore.openFlow(p.id)}
          >
            <span className={`flow-pane__sev flow-pane__sev--${p.severity}`}>sev {p.severity}</span>
            <span className="flow-pane__tab-label">{p.owasp ?? p.id}</span>
          </button>
        ))}
      </div>

      <div className="flow-pane__summary">
        <div className="flow-pane__summary-row">
          <span className="flow-pane__k">from</span>
          <span className="flow-pane__v flow-pane__v--source">{active.steps[0]?.symbol}</span>
          <span className="flow-pane__arrow">→</span>
          <span className="flow-pane__k">to</span>
          <span className="flow-pane__v flow-pane__v--sink">{active.steps[active.steps.length - 1]?.symbol}</span>
        </div>
        {active.owasp && (
          <div className="flow-pane__owasp">OWASP · {active.owasp}</div>
        )}
      </div>

      <ol className="flow-steps">
        {active.steps.map((s, i) => (
          <li key={i} className="flow-step">
            <div className="flow-step__rail">
              <span
                className="flow-step__dot"
                style={{ background: HOP_COLOR[s.hop] }}
                aria-hidden
              />
              {i < active.steps.length - 1 && <span className="flow-step__line" aria-hidden />}
            </div>
            <button
              type="button"
              className="flow-step__body"
              onClick={() => focusStore.jumpTo(s.line)}
            >
              <div className="flow-step__head">
                <span className={`flow-step__hop flow-step__hop--${s.hop}`}>{s.hop}</span>
                <span className="flow-step__line-no">L{s.line}</span>
                <span className="flow-step__sym">{s.symbol}</span>
              </div>
              <div className="flow-step__detail">{s.detail}</div>
              {s.file && <div className="flow-step__file">{s.file}</div>}
            </button>
          </li>
        ))}
      </ol>

      {active.sanitizerHints && active.sanitizerHints.length > 0 && (
        <div className="flow-pane__sanitize">
          <div className="flow-pane__sanitize-head">sanitizer options</div>
          <ul>
            {active.sanitizerHints.map((h, i) => (
              <li key={i} className="flow-pane__sanitize-item">{h}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function EmptyPane({ label }: { label: string }) {
  return <div className="empty-pane">{label}</div>;
}
