import type { IdeTheme } from "@/features/ide-theme";
import { IdeAuroraPicker } from "./IdeAuroraPicker";

interface IdeTopBarProps {
  path: string[];
  riskScore: number;
  onExit: () => void;
  onAsk: () => void;
  onRiskClick: () => void;
  onTimeTravel: () => void;
  theme: IdeTheme;
  onThemeToggle: () => void;
}

export function IdeTopBar({ path, riskScore, onExit, onAsk, onRiskClick, onTimeTravel, theme, onThemeToggle }: IdeTopBarProps) {
  const dots = Math.round((riskScore / 100) * 5);

  return (
    <div className="ide-topbar">
      <div className="ide-topbar-brand">p0</div>
      <div className="ide-topbar-path">
        {path.map((seg, i) => {
          const isLeaf = i === path.length - 1;
          return (
            <span key={`${seg}-${i.toString()}`} className="ide-topbar-path-seg">
              {i > 0 && <span className="crumb-sep">/</span>}{" "}
              <span className={isLeaf ? "crumb-leaf" : ""}>{seg}</span>{" "}
            </span>
          );
        })}
      </div>
      <button type="button" className="ide-topbar-ask" onClick={onAsk}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>Ask anything…</span>
        <span className="ide-topbar-ask-kbd">⌘K</span>
      </button>
      <button
        type="button"
        className="ide-topbar-time"
        onClick={onTimeTravel}
        title="Time travel (⌘T)"
        aria-label="Time travel"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
      </button>
      <button
        type="button"
        className="ide-topbar-theme"
        onClick={onThemeToggle}
        title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="ide-topbar-risk is-clickable"
        title="System risk — click for breakdown"
        onClick={onRiskClick}
      >
        <span>Risk</span>
        <span className="ide-topbar-risk-num">{riskScore}</span>
        <span className="ide-topbar-risk-dots" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <i key={i} className={i < dots ? "on" : ""} />
          ))}
        </span>
      </button>
      <IdeAuroraPicker />
      <button type="button" className="ide-exit" onClick={onExit}>
        Exit IDE
      </button>
    </div>
  );
}
