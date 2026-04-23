import { cn } from "@quanta/ui-kit/lib";
import type { AutopilotPage } from "@quanta/app-autopilot/shared/lib";
import { useAutopilot, selectors } from "@quanta/app-autopilot/stores";
import { AUTONOMY_LEVEL_META } from "@quanta/app-autopilot/entities/autonomy";
import { Chip, StatDot } from "@quanta/app-autopilot/shared/ui/primitives";
import "./top-bar.css";

interface TabDef {
  id: AutopilotPage;
  label: string;
  caption: string;
}

const TABS: readonly TabDef[] = [
  { id: "overview",      label: "Overview",      caption: "L0 · inbox"    },
  { id: "goals",         label: "Goals",         caption: "L2 · targets"  },
  { id: "runs",          label: "Runs",          caption: "L3 · activity" },
  { id: "workitems",     label: "Work items",    caption: "L1 · tasks"    },
  { id: "opportunities", label: "Opportunities", caption: "L2 · ideas"    },
  { id: "operators",     label: "Operators",     caption: "L4 · agents"   },
  { id: "policies",      label: "Policies",      caption: "L5 · rules"    },
  { id: "snapshot",      label: "Snapshot",      caption: "L6 · state"    },
];

export interface TopBarProps {
  current: AutopilotPage;
  onNavigate: (page: AutopilotPage) => void;
}

export function TopBar({ current, onNavigate }: TopBarProps) {
  const inboxCount = useAutopilot((s) => selectors.liveInbox(s).length);
  const runsRunning = useAutopilot((s) => s.runs.filter((r) => r.status === "running").length);
  const awaitingReview = useAutopilot(
    (s) => s.runs.filter((r) => r.status === "awaiting_review").length,
  );
  const goalCount = useAutopilot((s) => s.goals.length);
  const snapshot = useAutopilot((s) => s.snapshot);
  const autonomyProfiles = useAutopilot((s) => s.autonomyProfiles);

  const counts: Partial<Record<AutopilotPage, number>> = {
    overview: inboxCount,
    runs: runsRunning + awaitingReview,
    goals: goalCount,
  };

  const activeBand = autonomyProfiles[0];
  const bandMeta = activeBand ? AUTONOMY_LEVEL_META[activeBand.level] : null;

  return (
    <header className="ap-topbar">
      <div className="ap-topbar__hero">
        <div className="ap-topbar__hero-text">
          <h1 className="ap-topbar__title">
            Autopilot
            {bandMeta && activeBand && (
              <Chip
                tone={activeBand.level >= 3 ? "accent" : "success"}
                leading={<StatDot tone={activeBand.level >= 3 ? "accent" : "success"} />}
              >
                L{activeBand.level} · {bandMeta.title}
              </Chip>
            )}
          </h1>
          <p className="ap-topbar__sub">
            Autonomous Repo Engineer · goals steer · operators execute · proof lands.
          </p>
        </div>
      </div>

      <div className="ap-topbar__filters">
        <label className="ap-topbar__filter">
          <span className="ap-topbar__filter-k">Snapshot</span>
          <span className="ap-topbar__filter-v">{snapshot.repoRevision}</span>
        </label>
        <label className="ap-topbar__filter">
          <span className="ap-topbar__filter-k">Autonomy</span>
          <span className="ap-topbar__filter-v">{bandMeta?.title ?? "—"}</span>
        </label>
      </div>

      <nav className="ap-topbar__tabs" role="tablist" aria-label="Autopilot sections">
        {TABS.map((t, i) => {
          const isActive = current === t.id;
          const count = counts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={cn("ap-topbar__tab", isActive && "is-active")}
              onClick={() => onNavigate(t.id)}
            >
              <span className="ap-topbar__tab-label">{t.label}</span>
              <span className="ap-topbar__tab-caption">{t.caption}</span>
              {count != null && count > 0 ? (
                <span className="ap-topbar__tab-count" aria-label={`${count} items`}>
                  {count}
                </span>
              ) : (
                <span className="ap-topbar__tab-key" aria-hidden>
                  {i + 1}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
