import { useState } from "react";
import { tips } from "../../lib/home-picker.mock";

export function ContextualTips() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = tips.filter((t) => !dismissed.has(t.id)).slice(0, 3);
  if (visible.length === 0) return null;

  const dismiss = (id: string) => setDismissed((s) => new Set(s).add(id));

  return (
    <section className="hp__tips">
      <div className="hp__tips-head">
        <LightbulbIcon />
        <span className="hp__panel-label">Discover</span>
      </div>
      <div className="hp__tips-grid">
        {visible.map((tip) => (
          <div key={tip.id} className="hp__tip">
            <span className="hp__tip-body">
              <span className="hp__tip-title">{tip.title}</span>
              <span className="hp__tip-desc">{tip.description}</span>
            </span>
            <span className="hp__tip-foot">
              {tip.shortcut && <kbd className="hp__tip-kbd">{tip.shortcut}</kbd>}
              <button
                type="button"
                className="hp__tip-dismiss"
                aria-label="Dismiss tip"
                onClick={() => dismiss(tip.id)}
              >
                <CloseIcon />
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LightbulbIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
