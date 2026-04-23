import type { ReactNode } from "react";
import {
  BoxesIcon,
  Compass,
  Factory,
  FileLock2,
  Inbox,
  Lightbulb,
  ListChecks,
  ScrollText,
  ShieldCheck,
  Target,
} from "lucide-react";
import { cn } from "@quanta/ui-kit/lib";
import type { AutopilotPage } from "@quanta/app-autopilot/shared/lib";
import { useAutopilot, selectors } from "@quanta/app-autopilot/stores";
import "./nav-rail.css";

interface NavItem {
  id: AutopilotPage;
  label: string;
  icon: ReactNode;
  kbd?: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: "overview", label: "Overview", icon: <Inbox size={15} strokeWidth={1.8} aria-hidden />, kbd: "g o" },
  { id: "goals", label: "Goals", icon: <Target size={15} strokeWidth={1.8} aria-hidden />, kbd: "g g" },
  { id: "runs", label: "Runs", icon: <ScrollText size={15} strokeWidth={1.8} aria-hidden />, kbd: "g r" },
  { id: "workitems", label: "Work items", icon: <ListChecks size={15} strokeWidth={1.8} aria-hidden />, kbd: "g w" },
  { id: "opportunities", label: "Opportunities", icon: <Lightbulb size={15} strokeWidth={1.8} aria-hidden />, kbd: "g u" },
  { id: "operators", label: "Operators", icon: <Factory size={15} strokeWidth={1.8} aria-hidden />, kbd: "g p" },
  { id: "policies", label: "Policies", icon: <FileLock2 size={15} strokeWidth={1.8} aria-hidden />, kbd: "g l" },
  { id: "snapshot", label: "Snapshot", icon: <BoxesIcon size={15} strokeWidth={1.8} aria-hidden />, kbd: "g s" },
];

export interface NavRailProps {
  current: AutopilotPage;
  onNavigate: (page: AutopilotPage) => void;
}

export function NavRail({ current, onNavigate }: NavRailProps) {
  const inboxCount = useAutopilot((s) => selectors.liveInbox(s).length);
  const runsRunning = useAutopilot((s) => s.runs.filter((r) => r.status === "running").length);
  const awaitingReview = useAutopilot(
    (s) => s.runs.filter((r) => r.status === "awaiting_review").length,
  );

  const counts: Partial<Record<AutopilotPage, number>> = {
    overview: inboxCount,
    runs: runsRunning + awaitingReview,
  };

  return (
    <nav className="ap-nav" aria-label="Autopilot navigation">
      <div className="ap-nav__brand">
        <span className="ap-nav__brand-mark" aria-hidden>
          <Compass size={14} strokeWidth={2} aria-hidden />
        </span>
        <div className="ap-nav__brand-text">
          <span className="ap-nav__brand-title">Autopilot</span>
          <span className="ap-nav__brand-sub">Autonomous Repo Engineer</span>
        </div>
      </div>

      <ul className="ap-nav__list">
        {NAV_ITEMS.map((it) => {
          const isActive = current === it.id;
          const count = counts[it.id];
          return (
            <li key={it.id}>
              <button
                type="button"
                className={cn("ap-nav__item", isActive && "is-active")}
                onClick={() => onNavigate(it.id)}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="ap-nav__icon">{it.icon}</span>
                <span className="ap-nav__label">{it.label}</span>
                {count != null && count > 0 && (
                  <span className="ap-nav__count" aria-label={`${count} items`}>
                    {count}
                  </span>
                )}
                {it.kbd != null && <span className="ap-nav__kbd">{it.kbd}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="ap-nav__foot">
        <div className="ap-nav__foot-label">
          <ShieldCheck size={12} strokeWidth={2} aria-hidden />
          <span>verifier-backed proof</span>
        </div>
        <div className="ap-nav__foot-sub">snapshot {new Date().toISOString().slice(0, 10)}</div>
      </div>
    </nav>
  );
}
