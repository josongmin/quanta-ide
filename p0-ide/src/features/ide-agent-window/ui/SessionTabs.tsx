import { useTranslation } from "react-i18next";
import type { AgentSession } from "../model/useAgentWindow";
import { IconClose, IconPlus } from "./icons";

interface SessionTabsProps {
  sessions: AgentSession[];
  activeId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

export function SessionTabs({ sessions, activeId, onSwitch, onClose, onNew }: SessionTabsProps) {
  const { t } = useTranslation();
  return (
    <div className="agw-session-tabs">
      <div className="agw-session-tab-list">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`agw-session-tab${s.id === activeId ? " is-active" : ""}`}
            onClick={() => { onSwitch(s.id); }}
            title={s.title}
          >
            <span className="agw-session-tab-title">
              {s.title.length > 22 ? `${s.title.slice(0, 22)}…` : s.title}
            </span>
            {sessions.length > 1 && (
              <span
                className="agw-session-tab-close"
                role="button"
                tabIndex={0}
                aria-label={t("ide.agent.closeSession")}
                onClick={(e) => { e.stopPropagation(); onClose(s.id); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onClose(s.id); }
                }}
              >
                <IconClose />
              </span>
            )}
          </button>
        ))}
      </div>
      <button type="button" className="agw-session-new" onClick={onNew} aria-label="새 세션">
        <IconPlus />
      </button>
    </div>
  );
}
