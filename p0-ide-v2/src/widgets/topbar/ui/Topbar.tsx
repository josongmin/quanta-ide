import { type ReactNode } from "react";
import BoringAvatar from "boring-avatars";
import "./topbar.css";

export type AppKind = "home" | "ide" | "agent" | "pr";
export interface Tab { id: string; app: AppKind; label: string; }

interface TopbarProps {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}

export function Topbar({ tabs, activeId, onSelect, onClose, onAdd }: TopbarProps) {
  return (
    <header className="topbar" data-tauri-drag-region>
      <button type="button" className="topbar__home" title="Home" aria-label="Home">
        <HomeIcon />
      </button>

      <div className="topbar__tabs" role="tablist" data-tauri-drag-region>
        {tabs.map((t) => {
          const isActive = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`topbar__tab${isActive ? " is-active" : ""}`}
              onClick={() => onSelect(t.id)}
              title={t.label}
            >
              <span className="topbar__tab-icon" aria-hidden>
                {t.app === "home" ? <HomeTabIcon /> : t.app === "agent" ? <AgentIcon /> : t.app === "pr" ? <PrIcon /> : <CodeIcon />}
              </span>
              <span className="topbar__tab-label">{t.label}</span>
              <span
                className="topbar__tab-close"
                role="button"
                tabIndex={-1}
                aria-label="Close tab"
                onClick={(e) => { e.stopPropagation(); onClose(t.id); }}
              >
                <CloseIcon />
              </span>
            </button>
          );
        })}
        <button type="button" className="topbar__tab-add" onClick={onAdd} aria-label="New tab" title="New tab">
          <PlusIcon />
        </button>
      </div>

      <div className="topbar__drag" data-tauri-drag-region />

      <div className="topbar__right" data-tauri-drag-region>
        <IconButton title="Font"><span className="topbar__T">T</span></IconButton>
        <span className="topbar__sep" />
        <IconButton title="Search (⌘K)"><SearchIcon /></IconButton>
        <IconButton title="Notifications">
          <InboxIcon />
          <span className="topbar__badge">2</span>
        </IconButton>
        <IconButton title="Settings"><SettingsIcon /></IconButton>
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
    </header>
  );
}

function IconButton({ title, children }: { title: string; children: ReactNode }) {
  return (
    <button type="button" className="topbar__icon-btn" title={title} aria-label={title}>
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
function HomeIcon() {
  return (
    <svg {...SVG}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
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
function SettingsIcon() {
  return (
    <svg {...SVG}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
