import { useEffect, useRef, useState } from "react";
import type { FileFacts } from "@/entities/file";
import type { TaintHop } from "@/entities/taint";
import { focusStore, useFocusStore } from "@/shared/model/focus-store";
import { EmptyPane } from "@/shared/ui/empty-pane";

interface Props {
  file: FileFacts;
}

const HOP_COLOR: Record<TaintHop, string> = {
  source: "var(--warn)",
  propagate: "var(--fg-muted)",
  branch: "var(--accent)",
  sink: "var(--danger)",
};

// Typestate protocol mapping: hop kind → protocol state
const TYPESTATE_STATE: Record<TaintHop, { state: string; tone: "safe" | "flagged" | "unsafe"; hint: string }> = {
  source:    { state: "created",   tone: "flagged", hint: "trace comes in from external source · unvalidated" },
  propagate: { state: "forwarded", tone: "flagged", hint: "state carried through without transformation" },
  branch:    { state: "forwarded", tone: "flagged", hint: "branched without validate() call" },
  sink:      { state: "persisted", tone: "unsafe",  hint: "written to store without validator — sink reached unsafe" },
};

export function FlowPane({ file }: Props) {
  const activeId = useFocusStore((s) => s.flowPathId);
  const active = file.taintPaths.find((p) => p.id === activeId) ?? file.taintPaths[0];
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<number | null>(null);

  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
  }, [active?.id]);

  useEffect(() => {
    if (!playing || !active) return;
    if (stepIndex >= active.steps.length - 1) {
      setPlaying(false);
      return;
    }
    playRef.current = window.setTimeout(() => {
      setStepIndex((i) => i + 1);
    }, 900);
    return () => {
      if (playRef.current !== null) window.clearTimeout(playRef.current);
    };
  }, [playing, stepIndex, active]);

  if (!active) return <EmptyPane label="No taint paths detected" />;

  const currentStep = active.steps[stepIndex];
  const currentTypestate = currentStep ? TYPESTATE_STATE[currentStep.hop] : null;

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
          <li key={i} className={`flow-step${i === stepIndex ? " is-current" : ""}`}>
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
              onClick={() => {
                setStepIndex(i);
                focusStore.jumpTo(s.line);
              }}
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

      {/* ── Typestate trace ── */}
      <div className="typestate">
        <div className="typestate__head">
          <span className="typestate__kicker">Typestate</span>
          <span className="typestate__proto">TraceProtocol</span>
          <span className="typestate__at">
            step {stepIndex + 1} / {active.steps.length}
          </span>
        </div>

        <div className="typestate__chain" aria-label="Protocol state chain">
          {active.steps.map((s, i) => {
            const ts = TYPESTATE_STATE[s.hop];
            const isCurrent = i === stepIndex;
            const isPast = i < stepIndex;
            const cls = [
              "typestate__node",
              `typestate__node--${ts.tone}`,
              isCurrent ? "is-current" : "",
              isPast ? "is-past" : "",
            ].filter(Boolean).join(" ");
            return (
              <div key={i} className="typestate__cell">
                <button
                  type="button"
                  className={cls}
                  onClick={() => setStepIndex(i)}
                  title={`${ts.state} · ${ts.hint}`}
                >
                  <span className="typestate__node-label">{ts.state}</span>
                  <span className="typestate__node-loc">L{s.line}</span>
                </button>
                {i < active.steps.length - 1 && (
                  <span className="typestate__edge" aria-hidden>
                    <span className={`typestate__edge-line${isPast ? " is-past" : ""}`} />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {currentTypestate && (
          <div className={`typestate__hint typestate__hint--${currentTypestate.tone}`}>
            <span className="typestate__hint-label">{currentTypestate.state}</span>
            <span className="typestate__hint-text">{currentTypestate.hint}</span>
          </div>
        )}

        <div className="typestate__controls">
          <button
            type="button"
            className="typestate__btn"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex <= 0}
            aria-label="Previous step"
          >
            ◂ prev
          </button>
          <button
            type="button"
            className="typestate__btn typestate__btn--play"
            onClick={() => {
              if (stepIndex >= active.steps.length - 1) setStepIndex(0);
              setPlaying((p) => !p);
            }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "❙❙ pause" : "▶ play"}
          </button>
          <button
            type="button"
            className="typestate__btn"
            onClick={() => setStepIndex((i) => Math.min(active.steps.length - 1, i + 1))}
            disabled={stepIndex >= active.steps.length - 1}
            aria-label="Next step"
          >
            next ▸
          </button>
        </div>
      </div>

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
