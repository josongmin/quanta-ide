import { useTranslation } from "react-i18next";
import { IdeSettingsMenu } from "./IdeSettingsMenu";

interface IdeTopBarProps {
  path: string[];
  riskScore: number;
  onExit: () => void;
  onAsk: () => void;
  onRiskClick: () => void;
  onTimeTravel: () => void;
  onOpenPr: () => void;
  onAgent?: () => void;
}

export function IdeTopBar({ path, riskScore, onExit, onAsk, onRiskClick, onTimeTravel, onOpenPr, onAgent }: IdeTopBarProps) {
  const { t } = useTranslation();
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
        <span>{t("ide.topbar.ask")}</span>
        <span className="ide-topbar-ask-kbd">⌘K</span>
      </button>
      <div className="ide-topbar-right">
        {/* Group 1: icon-only utility buttons */}
        {/* Group 1: time travel */}
        <div className="ide-topbar-group">
          <button
            type="button"
            className="ide-topbar-time"
            onClick={onTimeTravel}
            title={t("ide.topbar.timeTravelTitle")}
            aria-label={t("ide.topbar.timeTravelAria")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
          </button>
        </div>

        <span className="ide-topbar-sep" aria-hidden />

        {/* Group 2: risk + PR */}
        <div className="ide-topbar-group">
          <button
            type="button"
            className="ide-topbar-risk is-clickable"
            title={t("ide.topbar.riskTitle")}
            onClick={onRiskClick}
          >
            <span>{t("ide.topbar.risk")}</span>
            <span className="ide-topbar-risk-num">{riskScore}</span>
            <span className="ide-topbar-risk-dots" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <i key={i} className={i < dots ? "on" : ""} />
              ))}
            </span>
          </button>
          <button
            type="button"
            className="ide-topbar-pr"
            onClick={onOpenPr}
            title={t("ide.topbar.prTitle")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="2.5" />
              <circle cx="6" cy="18" r="2.5" />
              <circle cx="18" cy="18" r="2.5" />
              <path d="M6 8.5v7" />
              <path d="M6 8.5c0 5 6 5 6 9.5" />
            </svg>
            <span>{t("ide.topbar.pr")}</span>
          </button>
        </div>

        <span className="ide-topbar-sep" aria-hidden />

        {/* Group 3: agent */}
        <div className="ide-topbar-group">
          <button
            type="button"
            className="ide-topbar-agent"
            onClick={onAgent}
            title="P0 Agent (⌘⇧A)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.3L12 16.5l-6.2 4.5 2.4-7.3L2 9.2h7.6z" />
            </svg>
            <span>Agent</span>
            <span className="ide-topbar-ask-kbd">⌘⇧A</span>
          </button>
        </div>

        <span className="ide-topbar-sep" aria-hidden />

        {/* Group 5: settings */}
        <div className="ide-topbar-group">
          <IdeSettingsMenu />
        </div>

        <span className="ide-topbar-sep" aria-hidden />

        {/* Group 6: exit */}
        <button type="button" className="ide-exit" onClick={onExit}>
          {t("ide.topbar.exit")}
        </button>
      </div>
    </div>
  );
}
