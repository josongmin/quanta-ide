import { ORCHESTRATOR } from "@/entities/file";
import { focusStore, useFocusStore } from "@/shared/model/focus-store";

export function SimulateOverlay() {
  const open = useFocusStore((s) => s.simulateOpen);
  if (!open) return null;

  const file = ORCHESTRATOR;

  return (
    <div className="sim-overlay" role="dialog" aria-modal="true" aria-label="Simulate change">
      <div className="sim-overlay__scrim" onClick={() => focusStore.toggleSimulate(false)} />
      <div className="sim-overlay__panel">
        <header className="sim-overlay__head">
          <div className="sim-overlay__kicker">Simulate change</div>
          <div className="sim-overlay__title">
            Mutate <code>execute()</code> · L8
          </div>
          <button
            type="button"
            className="sim-overlay__close"
            aria-label="Close"
            onClick={() => focusStore.toggleSimulate(false)}
          >×</button>
        </header>

        <section className="sim-overlay__body">
          <div className="sim-panel">
            <div className="sim-panel__h">mutation</div>
            <div className="sim-mut">
              <label className="sim-mut__row">
                <span className="sim-mut__k">request.ctx</span>
                <select className="sim-mut__v">
                  <option>trusted</option>
                  <option>untrusted (current)</option>
                  <option>fuzzed</option>
                </select>
              </label>
              <label className="sim-mut__row">
                <span className="sim-mut__k">result.is_terminal()</span>
                <select className="sim-mut__v">
                  <option>true first-hop</option>
                  <option>never (current)</option>
                  <option>always false</option>
                </select>
              </label>
              <label className="sim-mut__row">
                <span className="sim-mut__k">trace length</span>
                <select className="sim-mut__v">
                  <option>1</option>
                  <option>median (4)</option>
                  <option>pathological (10k+)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="sim-panel">
            <div className="sim-panel__h">predicted effects</div>
            <ul className="sim-eff">
              <li className="sim-eff__row sim-eff__row--bad">
                <span className="sim-eff__dot" />
                <span className="sim-eff__k">blast</span>
                <span className="sim-eff__v">{file.blast} → 47 <em>(+9)</em></span>
              </li>
              <li className="sim-eff__row sim-eff__row--bad">
                <span className="sim-eff__dot" />
                <span className="sim-eff__k">taint</span>
                <span className="sim-eff__v">2 → 3 paths <em>(new: API → store)</em></span>
              </li>
              <li className="sim-eff__row sim-eff__row--warn">
                <span className="sim-eff__dot" />
                <span className="sim-eff__k">cpx</span>
                <span className="sim-eff__v">9 → 11 <em>(budget 140%)</em></span>
              </li>
              <li className="sim-eff__row sim-eff__row--ok">
                <span className="sim-eff__dot" />
                <span className="sim-eff__k">behavior</span>
                <span className="sim-eff__v">1 semantic · 1 runtime</span>
              </li>
              <li className="sim-eff__row sim-eff__row--ok">
                <span className="sim-eff__dot" />
                <span className="sim-eff__k">proof</span>
                <span className="sim-eff__v">replay ready · 12 traces</span>
              </li>
            </ul>
          </div>
        </section>

        <footer className="sim-overlay__foot">
          <span className="sim-overlay__hint">
            <span className="symtip__kbd">Esc</span> dismiss
            <span className="symtip__kbd">⏎</span> apply
          </span>
          <div className="sim-overlay__actions">
            <button className="btn btn--ghost" onClick={() => focusStore.toggleSimulate(false)}>Cancel</button>
            <button className="btn btn--primary">Run simulation</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
