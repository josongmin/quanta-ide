import { useState } from "react";
import { focusStore, useFocusStore, ORCHESTRATOR } from "@/entities/engine";

export function ContextInjectOverlay() {
  const open = useFocusStore((s) => s.contextInjectOpen);
  const [prompt, setPrompt] = useState("");
  if (!open) return null;

  const file = ORCHESTRATOR;

  return (
    <div className="ctx-overlay" role="dialog" aria-modal="true" aria-label="Ask agent with context">
      <div className="ctx-overlay__scrim" onClick={() => focusStore.toggleContextInject(false)} />
      <div className="ctx-overlay__panel">
        <header className="ctx-overlay__head">
          <div className="ctx-overlay__kicker">Ask agent — context from cursor</div>
          <button
            type="button"
            className="ctx-overlay__close"
            aria-label="Close"
            onClick={() => focusStore.toggleContextInject(false)}
          >×</button>
        </header>

        <section className="ctx-overlay__card">
          <div className="ctx-card__h">auto-injected context</div>
          <ul className="ctx-card__list">
            <li>
              <span className="ctx-card__k">symbol</span>
              <span className="ctx-card__v"><code>execute()</code> · L8</span>
            </li>
            <li>
              <span className="ctx-card__k">risk</span>
              <span className="ctx-card__v">{file.riskScore}/100 · cpx {file.cpxMax.toFixed(1)} · tests 0/12</span>
            </li>
            <li>
              <span className="ctx-card__k">blast</span>
              <span className="ctx-card__v">{file.blast} files · {file.blastCritical} critical</span>
            </li>
            <li>
              <span className="ctx-card__k">taint</span>
              <span className="ctx-card__v">
                {file.taintPaths.length} paths · request.ctx → _store.save
              </span>
            </li>
            <li>
              <span className="ctx-card__k">incidents</span>
              <span className="ctx-card__v">
                {file.incidents.length > 0
                  ? `${file.incidents[0].id} · ${file.incidents[0].patternKind}`
                  : "none"}
              </span>
            </li>
            <li>
              <span className="ctx-card__k">ownership</span>
              <span className="ctx-card__v">
                {file.ownership.map((o) => `${o.author} ${o.pct}%`).join(" · ")}
              </span>
            </li>
          </ul>
        </section>

        <div className="ctx-overlay__prompt">
          <textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask the agent — context above is auto-included."
            rows={3}
          />
        </div>

        <footer className="ctx-overlay__foot">
          <span className="ctx-overlay__hint">
            <span className="symtip__kbd">Esc</span> dismiss
            <span className="symtip__kbd">⌘⏎</span> send
          </span>
          <div className="ctx-overlay__actions">
            <button className="btn btn--ghost" onClick={() => focusStore.toggleContextInject(false)}>Cancel</button>
            <button className="btn btn--primary" disabled={prompt.trim().length === 0}>Ask agent</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
