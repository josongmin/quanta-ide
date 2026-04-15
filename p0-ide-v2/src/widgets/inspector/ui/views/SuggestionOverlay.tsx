import { useEffect } from "react";
import { riskColor } from "@/shared/lib/risk";

export type VerifyState = "pass" | "warn" | "info";
export interface VerifyItem {
  state: VerifyState;
  label: string;
  engine: string;
  value?: string;
}

export interface SuggestionData {
  title: string;
  rationale: string;
  diff: string;
  riskBefore: number;
  riskAfter: number;
  verification: VerifyItem[];
  confidence: number;
}

interface Props {
  data: SuggestionData;
  onClose: () => void;
}

export function SuggestionOverlay({ data, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="insp__suggestion-overlay" role="dialog" aria-label="Suggested action">
      <div className="insp__suggestion-backdrop" onClick={onClose} aria-hidden />
      <div className="insp__suggestion-panel">
        <div className="insp__suggestion-head">
          <div className="insp__suggestion-head-text">
            <span className="insp__suggestion-title">Suggested action</span>
            <span className="insp__suggestion-kicker">evidence-backed patch</span>
          </div>
          <button
            type="button"
            className="insp__suggestion-close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="insp__suggestion-body">
          <div className="fix">
            <div className="fix__title-row">
              <span className="fix__title">{data.title}</span>
              <span className="fix__conf">confidence {data.confidence.toFixed(2)}</span>
            </div>
            <p className="fix__rationale">{data.rationale}</p>

            <RiskDelta before={data.riskBefore} after={data.riskAfter} />

            <pre className="fix__code">{data.diff}</pre>

            <VerificationList items={data.verification} />

            <div className="fix__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Dismiss <kbd>Esc</kbd>
              </button>
              <button type="button" className="btn btn--ghost">
                Simulate <kbd>⌘⇧S</kbd>
              </button>
              <button type="button" className="btn btn--primary">
                Apply <kbd>⏎</kbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskDelta({ before, after }: { before: number; after: number }) {
  const drop = before - after;
  const dropPct = before > 0 ? Math.round((drop / before) * 100) : 0;
  return (
    <div className="rdelta">
      <div className="rdelta__side">
        <RiskRing score={before} />
        <span className="rdelta__label">before</span>
      </div>
      <div className="rdelta__bridge" aria-hidden>
        <span className="rdelta__bridge-arrow">→</span>
        <span className="rdelta__bridge-delta">−{drop}</span>
        <span className="rdelta__bridge-pct">({dropPct}%)</span>
      </div>
      <div className="rdelta__side">
        <RiskRing score={after} />
        <span className="rdelta__label">after</span>
      </div>
    </div>
  );
}

function RiskRing({ score }: { score: number }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / 100));
  const color = riskColor(score);
  return (
    <div className="rring">
      <svg className="rring__svg" width="60" height="60" viewBox="0 0 60 60" aria-hidden>
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          transform="rotate(-90 30 30)"
        />
      </svg>
      <span className="rring__score" style={{ color }}>{score}</span>
    </div>
  );
}

function VerificationList({ items }: { items: VerifyItem[] }) {
  return (
    <ul className="verify">
      {items.map((it, i) => (
        <li key={i} className={`verify__row verify__row--${it.state}`}>
          <span className="verify__icon" aria-hidden>
            {it.state === "pass" ? "✓" : it.state === "warn" ? "!" : "·"}
          </span>
          <span className="verify__label">{it.label}</span>
          {it.value && <span className="verify__val">{it.value}</span>}
          <span className="verify__engine">{it.engine}</span>
        </li>
      ))}
    </ul>
  );
}
