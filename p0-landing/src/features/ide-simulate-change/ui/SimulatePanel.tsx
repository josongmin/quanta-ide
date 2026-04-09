import { useEffect } from "react";
import { useSimulateChange } from "../model/useSimulateChange";

export function SimulatePanel() {
  const { isOpen, close } = useSimulateChange();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="sim-root">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- decorative backdrop */}
      <div className="sim-backdrop" onClick={close} />
      <aside className="sim-panel" role="dialog" aria-modal="true">
        <header className="sim-head">
          <div className="sim-head-label">// SIMULATE CHANGE</div>
          <button type="button" className="sim-close" onClick={close} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </header>

        <div className="sim-body">
          <section className="sim-section">
            <div className="sim-section-label">Diff</div>
            <pre className="sim-diff">
              <span className="line"><span className="lineno">7</span>{"  const validated = parse(amount);"}</span>
              <span className="line del"><span className="lineno">8</span>{"- if (amount > 0) {"}</span>
              <span className="line add"><span className="lineno">8</span>{"+ if (amount >= 0) {"}</span>
              <span className="line"><span className="lineno">9</span>{"    await db.update({ amount });"}</span>
              <span className="line"><span className="lineno">10</span>{"  }"}</span>
            </pre>
          </section>

          <section className="sim-section">
            <div className="sim-section-label">Impact</div>
            <div className="sim-impact-grid">
              <div className="sim-impact">
                <div className="sim-impact-k">Blast Radius</div>
                <div className="sim-impact-v">31 <span className="arrow">→</span> 37 <span className="delta">(+6)</span></div>
              </div>
              <div className="sim-impact">
                <div className="sim-impact-k">Taint Paths</div>
                <div className="sim-impact-v">2 <span className="arrow">→</span> 3 <span className="delta">(+1)</span></div>
              </div>
              <div className="sim-impact">
                <div className="sim-impact-k">Tests at Risk</div>
                <div className="sim-impact-v">12 <span className="arrow">→</span> 14 <span className="delta">(+2)</span></div>
              </div>
              <div className="sim-impact">
                <div className="sim-impact-k">Behavior Δ</div>
                <div className="sim-impact-v">1 path</div>
              </div>
            </div>
          </section>

          <section className="sim-section">
            <div className="sim-section-label">Behavior Delta</div>
            <div className="sim-behavior">
              <div className="sim-behavior-row">
                <span className="sim-behavior-cond">amount === 0</span>
                <span className="sim-behavior-arrow">→</span>
                <span className="sim-behavior-result">now reaches db.update</span>
              </div>
            </div>
          </section>

          <section className="sim-section">
            <div className="sim-section-label">New Taint Path</div>
            <div className="sim-flow">
              <div className="sim-flow-step">req.body.amount</div>
              <div className="sim-flow-arrow">↓</div>
              <div className="sim-flow-step">processRefund</div>
              <div className="sim-flow-arrow">↓</div>
              <div className="sim-flow-step is-sink">db.update</div>
            </div>
          </section>

          <section className="sim-section">
            <div className="sim-section-label">Affected Tests</div>
            <div className="sim-tests">
              <div className="sim-test"><span className="status">fail</span>test_zero_amount_rejection</div>
              <div className="sim-test"><span className="status">fail</span>test_negative_returns_400</div>
              <div className="sim-test"><span className="status pass">pass</span>test_positive_amount</div>
              <div className="sim-test"><span className="status pass">pass</span>test_idempotency</div>
            </div>
          </section>

          <section className="sim-meta">
            <div className="sim-meta-row">
              <span className="sim-meta-k">Confidence</span>
              <span className="sim-meta-v">high</span>
            </div>
            <div className="sim-meta-row">
              <span className="sim-meta-k">Analyzed in</span>
              <span className="sim-meta-v">340ms</span>
            </div>
            <div className="sim-meta-row">
              <span className="sim-meta-k">Engine</span>
              <span className="sim-meta-v">behavior_diff · taint_flow</span>
            </div>
          </section>
        </div>

        <footer className="sim-foot">
          <button type="button" className="ide-btn" onClick={close}>
            Discard <span className="ide-btn-key">⎋</span>
          </button>
          <button type="button" className="ide-btn is-primary" onClick={close}>
            Apply <span className="ide-btn-key">⏎</span>
          </button>
        </footer>
      </aside>
    </div>
  );
}
