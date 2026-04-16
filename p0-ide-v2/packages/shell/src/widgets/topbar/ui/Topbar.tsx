import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import BoringAvatar from "boring-avatars";
import { cn } from "@quanta/ui-kit/lib";
import { uiBus, useUiBus } from "@quanta/shell/stores/ui-bus";
import { useWorkspaceTabStrip } from "../model/use-workspace-tab-strip";
import "./topbar.css";

/** Show floating title when tab is this narrow (px), or when the label is truncated. */
const TAB_TITLE_TIP_NARROW_PX = 128;

export type AppKind = "home" | "new-tab" | "ide" | "agent" | "pr" | "scenario" | "reviews" | "settings";
export interface Tab { id: string; app: AppKind; label: string; }

const TAB_ICON_REGISTRY: Record<AppKind, () => ReactNode> = {
  home: HomeTabIcon,
  "new-tab": HomeTabIcon,
  ide: CodeIcon,
  agent: AgentIcon,
  pr: PrIcon,
  scenario: CodeIcon,
  reviews: CodeIcon,
  settings: SettingsTabIcon,
};

interface TopbarProps {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
  homeOpen: boolean;
  onToggleHome: () => void;
}

function HomeButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn("topbar__home", active && "is-active")}
      title="Home"
      aria-label="Home"
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="topbar__logo">p0</span>
    </button>
  );
}

export function Topbar({ tabs, activeId, onSelect, onClose, onAdd, homeOpen, onToggleHome }: TopbarProps) {
  const settingsOpen = useUiBus((s) => s.settingsOpen);
  const homeActive = !settingsOpen && homeOpen;
  const handleHomeClick = () => {
    if (settingsOpen) uiBus.toggleSettings(false);
    onToggleHome();
  };
  const { stripRef, onStripMouseLeave, beginCloseTab, tabChrome } = useWorkspaceTabStrip(onClose);

  const [tabTitleTip, setTabTitleTip] = useState<{ label: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const clear = () => setTabTitleTip(null);
    window.addEventListener("resize", clear);
    window.addEventListener("scroll", clear, true);
    return () => {
      window.removeEventListener("resize", clear);
      window.removeEventListener("scroll", clear, true);
    };
  }, []);

  const showTabTitleTip = (e: React.MouseEvent<HTMLButtonElement>, label: string) => {
    const tab = e.currentTarget;
    const r = tab.getBoundingClientRect();
    const labelEl = tab.querySelector<HTMLElement>(".topbar__tab-label");
    const truncated = labelEl != null && labelEl.scrollWidth > labelEl.clientWidth + 2;
    const narrow = r.width < TAB_TITLE_TIP_NARROW_PX;
    if (!narrow && !truncated) {
      setTabTitleTip(null);
      return;
    }
    setTabTitleTip({ label, x: r.left + r.width / 2, y: r.bottom + 6 });
  };

  const clearTabTitleTip = () => setTabTitleTip(null);

  const handleTabsMouseLeave = () => {
    clearTabTitleTip();
    onStripMouseLeave();
  };

  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="topbar__left" data-tauri-drag-region>
        <HomeButton active={homeActive} onClick={handleHomeClick} />
        <div
          className="topbar__tabs"
          role="tablist"
          data-tauri-drag-region
          ref={stripRef}
          onMouseLeave={handleTabsMouseLeave}
        >
          {tabs.map((t) => {
            const isActive = !settingsOpen && !homeOpen && t.id === activeId;
            const { className, style, innerStyle } = tabChrome(t.id, isActive);
            const Icon = TAB_ICON_REGISTRY[t.app] ?? CodeIcon;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                data-tab-id={t.id}
                aria-selected={isActive}
                className={className}
                style={style}
                aria-label={t.label}
                onMouseEnter={(e) => showTabTitleTip(e, t.label)}
                onMouseLeave={clearTabTitleTip}
                onClick={() => {
                  if (settingsOpen) uiBus.toggleSettings(false);
                  onSelect(t.id);
                }}
              >
                <span className="topbar__tab-inner" style={innerStyle}>
                  <span className="topbar__tab-icon" aria-hidden>
                    <Icon />
                  </span>
                  <span className="topbar__tab-label">{t.label}</span>
                  <span
                    className="topbar__tab-close"
                    aria-hidden="true"
                    onClick={(e) => { e.stopPropagation(); beginCloseTab(t.id); }}
                  >
                    <CloseIcon />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" className="topbar__tab-add" onClick={onAdd} aria-label="New tab" title="New tab">
          <PlusIcon />
        </button>
        <div className="topbar__tabs-drag" data-tauri-drag-region aria-hidden />
      </div>

      <div className="topbar__right" data-tauri-drag-region>
        <div className="topbar__utilities" role="toolbar" aria-label="Search and account actions">
          <IconButton title="Search (⌘K)"><SearchIcon /></IconButton>
          <IconButton title="Notifications">
            <InboxIcon />
            <span className="topbar__badge">2</span>
          </IconButton>
          <IconButton
            title="Settings (⌘,)"
            onClick={() => uiBus.toggleSettings()}
            active={settingsOpen}
          >
            <SettingsIcon />
          </IconButton>
        </div>
        <span className="topbar__sep" />
        <button type="button" className="topbar__profile" title="Song Min" aria-label="Profile">
          <span className="topbar__avatar" aria-hidden>
            <BoringAvatar
              size={20}
              name="Song Min"
              variant="pixel"
              colors={["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"]}
            />
          </span>
          <span className="topbar__profile-name">Song Min</span>
        </button>
      </div>

      {tabTitleTip != null &&
        createPortal(
          <div
            className="topbar-tab-tooltip"
            role="tooltip"
            style={{ left: tabTitleTip.x, top: tabTitleTip.y }}
          >
            {tabTitleTip.label}
          </div>,
          document.body,
        )}
    </header>
  );
}

function IconButton({
  title,
  children,
  onClick,
  active,
}: {
  title: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("topbar__icon-btn", active && "is-active")}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const SVG = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
function CodeIcon() {
  return (
    <svg {...SVG} width="13" height="13">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function HomeTabIcon() {
  return (
    <svg {...SVG} width="13" height="13">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function AgentIcon() {
  return (
    <svg {...SVG} width="13" height="13">
      <rect x="4" y="6" width="16" height="13" rx="2" />
      <path d="M9 3v3M15 3v3M9 13h.01M15 13h.01M9 17h6" />
    </svg>
  );
}
function PrIcon() {
  return (
    <svg {...SVG} width="13" height="13">
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M6 8.2v7.6M18 15.8V11a4 4 0 0 0-4-4h-2.5l2 2m0-4l-2 2" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg {...SVG} width="10" height="10" strokeWidth={2.2}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg {...SVG} width="13" height="13">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg {...SVG}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function InboxIcon() {
  return (
    <svg {...SVG}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
function SettingsTabIcon() {
  return (
    <svg {...SVG} width="13" height="13">
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg {...SVG}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
