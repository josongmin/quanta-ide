import { useEffect, useRef, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import type { TaintHop } from "@quanta/app-ide/entities/taint";
import { focusStore, useFocusStore } from "@quanta/app-ide/stores/focus-store";
import { EmptyPane } from "@quanta/ui-kit/ui/empty-pane";

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

      <header className="fp-head">
        <h2 className="fp-head__title">Taint flow</h2>
        <p className="fp-head__desc">
          Untrusted input reaches a sink without passing a sanitizer.
          {active.owasp && <> Mapped to OWASP <strong>{active.owasp}</strong>.</>}
        </p>
        <div className="fp-head__path">
          <span className="fp-head__path-label">source</span>
          <span className="fp-head__path-sym fp-head__path-sym--source">{active.steps[0]?.symbol}</span>
          <span className="fp-head__path-arrow">→</span>
          <span className="fp-head__path-label">sink</span>
          <span className="fp-head__path-sym fp-head__path-sym--sink">{active.steps[active.steps.length - 1]?.symbol}</span>
        </div>
      </header>

      <section className="fp-block">
        <div className="fp-block__h">
          <h3 className="fp-block__title">Trace</h3>
          <p className="fp-block__desc">{active.steps.length} hops from source to sink.</p>
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
      </section>

      <section className="fp-block">
        <div className="fp-block__h">
          <h3 className="fp-block__title">Typestate</h3>
          <p className="fp-block__desc">
            Protocol state at each hop · <code>TraceProtocol</code> · step {stepIndex + 1} / {active.steps.length}.
          </p>
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
            Prev
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
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="typestate__btn"
            onClick={() => setStepIndex((i) => Math.min(active.steps.length - 1, i + 1))}
            disabled={stepIndex >= active.steps.length - 1}
            aria-label="Next step"
          >
            Next
          </button>
        </div>
      </section>

      {active.sanitizerHints && active.sanitizerHints.length > 0 && (
        <section className="fp-block">
          <div className="fp-block__h">
            <h3 className="fp-block__title">Sanitizer options</h3>
            <p className="fp-block__desc">Recommended fixes to break this taint path.</p>
          </div>
          <ul className="fp-sanitize">
            {active.sanitizerHints.map((h, i) => (
              <li key={i} className="fp-sanitize__item">{h}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
