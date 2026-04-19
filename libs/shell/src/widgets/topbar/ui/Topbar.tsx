import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import BoringAvatar from "boring-avatars";
import {
  Bot,
  Code2,
  FileCheck,
  GitPullRequest,
  Home,
  Inbox,
  LayoutGrid,
  Plus,
  Rocket,
  Search,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { cn } from "@quanta/ui-kit/lib";
import { uiBus, useUiBus } from "@quanta/shell/stores/ui-bus";
import { useWorkspaceTabStrip } from "../model/use-workspace-tab-strip";
import "./topbar.css";

/** Show floating title when tab is this narrow (px), or when the label is truncated. */
const TAB_TITLE_TIP_NARROW_PX = 128;

export type AppKind = "home" | "new-tab" | "ide" | "workspace" | "universe" | "agent" | "pr" | "scenario" | "reviews" | "policy" | "settings" | "demo";
export interface Tab { id: string; app: AppKind; label: string; }

const TAB_ICON_SIZE = 13;
const TAB_ICON_STROKE = 1.8;

const TAB_ICON_REGISTRY: Record<AppKind, () => ReactNode> = {
  home:        () => <Home            size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden />,
  "new-tab":   () => <Home            size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden />,
  ide:         () => <Code2           size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden />,
  workspace:   () => <LayoutGrid      size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden />,
  universe:    () => <LayoutGrid      size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden />,
  agent:       () => <Bot             size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden />,
  pr:          () => <GitPullRequest  size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden />,
  scenario:    () => <Code2           size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden />,
  reviews:     () => <FileCheck       size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden />,
  policy:      () => <Shield          size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden />,
  settings:    () => <Settings        size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden />,
  demo:        () => <Rocket          size={TAB_ICON_SIZE} strokeWidth={TAB_ICON_STROKE} aria-hidden />,
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
            const Icon = TAB_ICON_REGISTRY[t.app] ?? TAB_ICON_REGISTRY.ide;
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
                    <X size={12} strokeWidth={2.2} aria-hidden />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" className="topbar__tab-add" onClick={onAdd} aria-label="New tab" title="New tab">
          <Plus size={14} strokeWidth={1.8} aria-hidden />
        </button>
        <div className="topbar__tabs-drag" data-tauri-drag-region aria-hidden />
      </div>

      <div className="topbar__right" data-tauri-drag-region>
        <div className="topbar__utilities" role="toolbar" aria-label="Search and account actions">
          <IconButton title="Search (⌘K)"><Search size={16} strokeWidth={1.8} aria-hidden /></IconButton>
          <IconButton title="Notifications">
            <Inbox size={16} strokeWidth={1.8} aria-hidden />
            <span className="topbar__badge">2</span>
          </IconButton>
          <IconButton
            title="Settings (⌘,)"
            onClick={() => uiBus.toggleSettings()}
            active={settingsOpen}
          >
            <Settings size={16} strokeWidth={1.8} aria-hidden />
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

