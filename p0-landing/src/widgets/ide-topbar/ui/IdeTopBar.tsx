import { useTranslation } from "react-i18next";
import { IdeSettingsMenu } from "./IdeSettingsMenu";
import { UserMenu } from "./UserMenu";

interface IdeTopBarProps {
  path: string[];
  onExit: () => void;
  onAsk: () => void;
  onTimeTravel: () => void;
}

export function IdeTopBar({ path, onExit, onAsk, onTimeTravel: _onTimeTravel }: IdeTopBarProps) {
  const { t } = useTranslation();

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

        {/* Commit button */}
        <div className="ide-topbar-group">
          <button type="button" className="ide-topbar-commit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <line x1="3" y1="12" x2="9" y2="12" />
              <line x1="15" y1="12" x2="21" y2="12" />
            </svg>
            <span>Commit</span>
            <svg className="ide-topbar-commit-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <span className="ide-topbar-sep" aria-hidden />

        {/* Line diff */}
        <div className="ide-topbar-group">
          <button type="button" className="ide-topbar-diff" title="Line changes">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="12" x2="15" y2="12" />
              <line x1="12" y1="9" x2="12" y2="15" />
            </svg>
            <span className="ide-topbar-diff-add">+10,453</span>
            <span className="ide-topbar-diff-del">-1,554</span>
          </button>
        </div>

        <span className="ide-topbar-sep" aria-hidden />

        {/* Review count */}
        <div className="ide-topbar-group">
          <button type="button" className="ide-settings-trigger" style={{ position: "relative" }} title="Pending reviews">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="ide-topbar-badge">3</span>
          </button>
        </div>

        {/* Notification bell */}
        <div className="ide-topbar-group">
          <button type="button" className="ide-settings-trigger" style={{ position: "relative" }} title="Notifications">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="ide-topbar-badge ide-topbar-badge--alert">2</span>
          </button>
        </div>

        <span className="ide-topbar-sep" aria-hidden />

        {/* Settings */}
        <div className="ide-topbar-group">
          <IdeSettingsMenu />
        </div>

        <span className="ide-topbar-sep" aria-hidden />

        {/* User profile */}
        <UserMenu onExit={onExit} />
      </div>
    </div>
  );
}
