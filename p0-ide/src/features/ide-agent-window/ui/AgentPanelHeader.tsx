import { useTranslation } from "react-i18next";
import { IconButton, IconClose as SharedIconClose } from "@/shared/ui";

/* pin / unpin icon — thumbtack */
function IconPin({ pinned }: { pinned: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* needle going down */}
      <line x1="7" y1="9" x2="7" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      {/* top cap */}
      <rect x="3.5" y="1" width="7" height="2.2" rx="1.1" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.15"/>
      {/* body trapezoid */}
      <path d="M4.2 3.2L3.2 9H10.8L9.8 3.2H4.2Z" fill={pinned ? "currentColor" : "none"} fillOpacity="0.18" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round"/>
    </svg>
  );
}

export interface AgentPanelHeaderProps {
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function AgentPanelHeader({ pinned, onTogglePin, onClose, onMouseDown }: AgentPanelHeaderProps) {
  const { t } = useTranslation();

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <header className="agw-header" onMouseDown={onMouseDown}>
      <div className="agw-header-left">
        <span className="agw-header-logo">p0</span>
        <span className="agw-header-sep">/</span>
        <span className="agw-repo-name">acme/payments-api</span>
      </div>
      <div className="agw-header-actions">
        <button
          type="button"
          className={`agw-pin-btn${pinned ? " is-pinned" : ""}`}
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          aria-label={pinned ? t("ide.agent.pinFloat") : t("ide.agent.pinFloatFixed")}
          title={pinned ? t("ide.agent.pinTitle.pinned") : t("ide.agent.pinTitle.unpinned")}
        >
          <IconPin pinned={pinned} />
        </button>
        <IconButton
          variant="ghost"
          size="sm"
          onClick={onClose}
          onMouseDown={(e) => { e.stopPropagation(); }}
          aria-label={t("ide.agent.close")}
        >
          <SharedIconClose size={12} strokeWidth={2} />
        </IconButton>
      </div>
    </header>
  );
}
