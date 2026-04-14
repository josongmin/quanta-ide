import { useState } from "react";
import { TERM_SESSIONS } from "@/entities/terminal";

export function TerminalPane() {
  const [activeId, setActiveId] = useState(TERM_SESSIONS[0].id);
  return (
    <div className="pane pane--terminal">
      <div className="term-tabs" role="tablist">
        {TERM_SESSIONS.map((s) => {
          const active = s.id === activeId;
          return (
            <div
              key={s.id}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              className={`term-tab${active ? " is-active" : ""}`}
              onClick={() => setActiveId(s.id)}
            >
              <span className="term-tab-dot" aria-hidden />
              <span className="term-tab-name">{s.label}</span>
              {s.sub && <span className="term-tab-sub">{s.sub}</span>}
              <button
                type="button"
                className="term-tab-close"
                aria-label={`Close ${s.label}`}
                onClick={(e) => e.stopPropagation()}
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          );
        })}
        <button type="button" className="term-tab-new" aria-label="New terminal">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
      </div>
      <pre className="term-body">
{`$ pnpm test
  › payments-api:test
  ✓ refund flow (12ms)
  ✓ routing policy resolves (8ms)
  ✗ orchestrator.execute guards taint sink (43ms)
    Expected: UnvalidatedTrace
    Received: undefined

2 passed, 1 failed
$ `}
        <span className="term-cursor" />
      </pre>
    </div>
  );
}
