import {
  IconChevronDown,
  IconInbox,
  IconSearch,
} from "@/shared/ui/icons/icons";
import { useGnbStore, type AppType } from "@/entities/gnb";
import { FontSwitcher } from "./FontSwitcher";
import { IdeSettingsMenu } from "./IdeSettingsMenu";
import { UserMenu } from "./UserMenu";

interface IdeTopBarProps {
  onAsk: () => void;
  onTimeTravel: () => void;
}

const isTauri = "__TAURI_INTERNALS__" in window;

/* ── App catalog for the [+] picker ── */
/* Home icon — separate since it's icon-only */
const HOME_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;

const APP_CATALOG: { app: AppType; label: string; icon: JSX.Element }[] = [
  { app: "ide",      label: "IDE",      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg> },
  { app: "review",   label: "Review",   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z" /><polyline points="14 3 14 8 21 8" /><path d="M9 15l2 2 4-4" /></svg> },
  { app: "agent",    label: "Agent",    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /><circle cx="9" cy="16" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="16" r="1" fill="currentColor" stroke="none" /></svg> },
  { app: "quality",  label: "Quality",  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg> },
  { app: "security", label: "Security", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
  { app: "policy",   label: "Policy",   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" /><polyline points="14 2 14 8 20 8" /><path d="M2 15h10" /><path d="M9 12l3 3-3 3" /></svg> },
];

export function IdeTopBar({ onAsk, onTimeTravel: _onTimeTravel }: IdeTopBarProps) {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab } = useGnbStore();

  return (
    <div className="ide-topbar">
      {/* ── Tab bar ── */}
      <div className="ide-tab-bar">
        {tabs.map((tab) => {
          const isHome = tab.app === "home";
          const isActive = tab.id === activeTabId;
          const icon = isHome ? HOME_ICON : APP_CATALOG.find(a => a.app === tab.app)?.icon;

          return (
            <button
              key={tab.id}
              type="button"
              className={`ide-tab${isActive ? " is-active" : ""}${isHome ? " ide-tab-home" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              <span className="ide-tab-icon">{icon}</span>
              {!isHome && <span className="ide-tab-label">{tab.label}</span>}
              {!isHome && (
                <span
                  className="ide-tab-close"
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  aria-label="Close tab"
                >
                  ×
                </span>
              )}
            </button>
          );
        })}

        {/* [+] Add tab — opens as "new" tab with app picker inside */}
        <button
          type="button"
          className="ide-tab-add"
          onClick={() => addTab("home", "새로 등록")}
          aria-label="New tab"
        >
          +
        </button>
      </div>

      {/* Drag region — empty space between tabs and right actions */}
      {isTauri && <div className="ide-topbar-drag" data-tauri-drag-region />}

      {/* ── Right actions ── */}
      <div className="ide-topbar-right">
        <FontSwitcher />

        <span className="ide-topbar-sep" aria-hidden />

        <button type="button" className="ide-topbar-icon-btn" title="Search (⌘K)" onClick={onAsk}>
          <IconSearch size={15} />
        </button>

        <button type="button" className="ide-topbar-icon-btn" title="Notifications">
          <IconInbox size={15} />
          <span className="ide-topbar-badge ide-topbar-badge--alert">2</span>
        </button>

        <IdeSettingsMenu />

        <span className="ide-topbar-sep" aria-hidden />

        <UserMenu />
      </div>
    </div>
  );
}
