import { useTranslation } from "react-i18next";
import {
  IconBell,
  IconChevronDown,
  IconDiffStat,
  IconGitCommit,
  IconMessageSquare,
  IconSearch,
} from "@/shared/ui/icons/icons";
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
        <IconSearch size={13} />
        <span>{t("ide.topbar.ask")}</span>
        <span className="ide-topbar-ask-kbd">⌘K</span>
      </button>
      <div className="ide-topbar-right">

        {/* Commit button */}
        <div className="ide-topbar-group">
          <button type="button" className="ide-topbar-commit">
            <IconGitCommit size={14} />
            <span>Commit</span>
            <IconChevronDown size={11} className="ide-topbar-commit-caret" />
          </button>
        </div>

        <span className="ide-topbar-sep" aria-hidden />

        {/* Line diff */}
        <div className="ide-topbar-group">
          <button type="button" className="ide-topbar-diff" title="Line changes">
            <IconDiffStat size={13} />
            <span className="ide-topbar-diff-add">+10,453</span>
            <span className="ide-topbar-diff-del">-1,554</span>
          </button>
        </div>

        <span className="ide-topbar-sep" aria-hidden />

        {/* Review count */}
        <button type="button" className="ide-topbar-icon-btn" title="Pending reviews">
          <IconMessageSquare size={16} strokeWidth={1.5} />
          <span className="ide-topbar-badge">3</span>
        </button>

        {/* Notification bell */}
        <button type="button" className="ide-topbar-icon-btn" title="Notifications">
          <IconBell size={16} strokeWidth={1.5} />
          <span className="ide-topbar-badge ide-topbar-badge--alert">2</span>
        </button>

        {/* Settings */}
        <IdeSettingsMenu />

        <span className="ide-topbar-sep" aria-hidden />

        {/* User profile */}
        <UserMenu onExit={onExit} />
      </div>
    </div>
  );
}
