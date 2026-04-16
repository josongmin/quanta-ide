import { useEffect } from "react";
import {
  PATTERN_DESCRIPTIONS,
  type ContextChunk,
} from "@quanta/app-ide/entities/firewall";
import { TRUST_LABEL, fmt } from "./firewall-overlay.utils";

interface PromoteConfirmModalProps {
  chunk: ContextChunk;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PromoteConfirmModal({
  chunk,
  onConfirm,
  onCancel,
}: PromoteConfirmModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="fw-confirm" role="dialog" aria-label="Firewall confirm">
      <div className="fw-confirm__scrim" onClick={onCancel} aria-hidden />
      <div className="fw-confirm__panel">
        <header className="fw-confirm__head">
          <span className="fw-confirm__kicker">Firewall · promote</span>
          <span className="fw-confirm__title">Use untrusted context in agent decisions?</span>
          <button type="button" className="fw-confirm__close" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="fw-confirm__body">
          <dl className="fw-confirm__meta">
            <div className="fw-confirm__row"><dt>Source</dt><dd>{chunk.source.label}</dd></div>
            <div className="fw-confirm__row"><dt>Kind</dt><dd><code>{chunk.source.kind}</code></dd></div>
            <div className="fw-confirm__row">
              <dt>Trust</dt>
              <dd>
                <span className={`fw-row__trust fw-row__trust--${chunk.trust.replace("-", "")}`}>
                  {TRUST_LABEL[chunk.trust]}
                </span>
              </dd>
            </div>
            <div className="fw-confirm__row"><dt>Tokens</dt><dd>{fmt(chunk.tokens)}</dd></div>
          </dl>

          {chunk.scan.suspicious && (
            <div className="fw-confirm__scan">
              <div className="fw-confirm__scan-h">Scanner hits</div>
              <ul className="fw-confirm__scan-list">
                {chunk.scan.hits.map((h) => (
                  <li key={h.patternId} className="fw-confirm__scan-row">
                    <span className="fw-confirm__scan-id">{h.patternId}</span>
                    <span className="fw-confirm__scan-desc">{PATTERN_DESCRIPTIONS[h.patternId]}</span>
                    <span className="fw-confirm__scan-conf">{(h.confidence * 100).toFixed(0)}%</span>
                    {h.excerpt && <span className="fw-confirm__scan-excerpt">"{h.excerpt}"</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="fw-confirm__preview">
            <div className="fw-confirm__preview-h">Preview</div>
            <pre className="fw-confirm__preview-body">{chunk.preview}</pre>
          </div>
        </div>
        <footer className="fw-confirm__foot">
          <span className="fw-confirm__hint">
            <kbd>Esc</kbd> cancel
          </span>
          <div className="fw-confirm__actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel}>Deny</button>
            <button type="button" className="btn btn--primary" onClick={onConfirm}>
              Allow &amp; promote
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
