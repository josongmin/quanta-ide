import { useState } from "react";
import {
  IconChevronDown,
  IconGitCommit,
  IconInbox,
  IconSearch,
} from "@/shared/ui/icons/icons";
import { IdeSettingsMenu } from "./IdeSettingsMenu";
import { UserMenu } from "./UserMenu";

interface IdeTopBarProps {
  onAsk: () => void;
  onTimeTravel: () => void;
}

type GnbTab = "code" | "review" | "agent" | "quality" | "security" | "insight";

export function IdeTopBar({ onAsk, onTimeTravel: _onTimeTravel }: IdeTopBarProps) {
  const [activeTab, setActiveTab] = useState<GnbTab>("code");

  return (
    <div className="ide-topbar" data-tauri-drag-region>
      <div className="ide-topbar-brand">p0</div>

      {/* Org switcher */}
      <button type="button" className="ide-topbar-org">
        <span className="ide-topbar-org-sep" aria-hidden>/</span>
        <svg className="ide-topbar-org-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" />
          <path d="M12 8v4M8.5 16.5 12 12M15.5 16.5 12 12" />
        </svg>
        <span className="ide-topbar-org-name">josongmin&apos;s Org</span>
        <span className="ide-topbar-org-badge">Free</span>
        <IconChevronDown size={11} className="ide-topbar-org-caret" />
      </button>

      {/* ── GNB Center Tabs ── */}
      <nav className="ide-gnb-tabs" aria-label="Main navigation">
        <button
          type="button"
          className={`ide-gnb-tab${activeTab === "code" ? " is-active" : ""}`}
          onClick={() => setActiveTab("code")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span>Code</span>
        </button>
        <button
          type="button"
          className={`ide-gnb-tab${activeTab === "review" ? " is-active" : ""}`}
          onClick={() => setActiveTab("review")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z" />
            <polyline points="14 3 14 8 21 8" />
            <path d="M9 15l2 2 4-4" />
          </svg>
          <span>Review</span>
        </button>
        <button
          type="button"
          className={`ide-gnb-tab${activeTab === "agent" ? " is-active" : ""}`}
          onClick={() => setActiveTab("agent")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <circle cx="9" cy="16" r="1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="16" r="1" fill="currentColor" stroke="none" />
          </svg>
          <span>Agent</span>
        </button>
        <button
          type="button"
          className={`ide-gnb-tab${activeTab === "quality" ? " is-active" : ""}`}
          onClick={() => setActiveTab("quality")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span>Quality</span>
        </button>
        <button
          type="button"
          className={`ide-gnb-tab${activeTab === "security" ? " is-active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Security</span>
        </button>
        <button
          type="button"
          className={`ide-gnb-tab${activeTab === "insight" ? " is-active" : ""}`}
          onClick={() => setActiveTab("insight")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M11 8v6M8 11h6" />
          </svg>
          <span>Insight</span>
        </button>
      </nav>

      <div className="ide-topbar-right">

        {/* Commit + diff stat (merged) */}
        <div className="ide-topbar-group">
          <button type="button" className="ide-topbar-commit">
            <IconGitCommit size={14} />
            <span>Commit</span>
            <IconChevronDown size={11} className="ide-topbar-commit-caret" />
          </button>
        </div>

        <span className="ide-topbar-sep" aria-hidden />

        {/* Search */}
        <button type="button" className="ide-topbar-icon-btn" title="Search (⌘K)" onClick={onAsk}>
          <IconSearch size={15} />
        </button>

        {/* Notifications (inbox) */}
        <button type="button" className="ide-topbar-icon-btn" title="Notifications">
          <IconInbox size={15} />
          <span className="ide-topbar-badge ide-topbar-badge--alert">2</span>
        </button>

        {/* Settings */}
        <IdeSettingsMenu />

        <span className="ide-topbar-sep" aria-hidden />

        {/* User profile */}
        <UserMenu />
      </div>
    </div>
  );
}
