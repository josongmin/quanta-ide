import { Plus, Check, ArrowRight } from "lucide-react";
import { cn } from "@quanta/ui-kit/lib";
import { Avatars } from "../../internal/Avatars";
import { initials } from "../../internal/avatar-utils";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface Workspace {
  id: string;
  name: string;
  role: string;
  plan: string;
  cycle?: string;
  seatsUsed: number;
  seatsTotal: number;
  members: string[];
  lastVisited: string;
  accent: { from: string; to: string };
  current?: boolean;
}

const WORKSPACES: Workspace[] = [
  {
    id: "acme",
    name: "Acme Inc.",
    role: "Owner",
    plan: "Team",
    cycle: "Yearly",
    seatsUsed: 12,
    seatsTotal: 25,
    members: ["Ada Lovelace", "Alan Turing", "Grace Hopper", "Linus Torvalds", "Margaret Hamilton", "Donald Knuth"],
    lastVisited: "Just now",
    accent: { from: "#6366f1", to: "#a855f7" },
    current: true,
  },
  {
    id: "oss",
    name: "Acme Open Source",
    role: "Admin",
    plan: "Free",
    seatsUsed: 4,
    seatsTotal: 10,
    members: ["Ada Lovelace", "Linus Torvalds", "Donald Knuth"],
    lastVisited: "2 days ago",
    accent: { from: "#10b981", to: "#06b6d4" },
  },
  {
    id: "labs",
    name: "Acme Labs",
    role: "Engineer",
    plan: "Team",
    cycle: "Monthly",
    seatsUsed: 7,
    seatsTotal: 10,
    members: ["Ada Lovelace", "Margaret Hamilton", "Grace Hopper", "Alan Turing"],
    lastVisited: "Last week",
    accent: { from: "#f97316", to: "#e11d48" },
  },
  {
    id: "sandbox",
    name: "ada's sandbox",
    role: "Owner",
    plan: "Free",
    seatsUsed: 1,
    seatsTotal: 3,
    members: ["Ada Lovelace"],
    lastVisited: "3 hours ago",
    accent: { from: "#f59e0b", to: "#ec4899" },
  },
];

export function WorkspacesPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Team"
        title="Workspaces"
        sub="Switch between organizations, or spin up a new workspace for a separate project or client."
      />
      <div className="demo-app__body">
        <div className="demo-sectionbar">
          <div className="demo-sectionbar__title">{WORKSPACES.length} workspaces</div>
          <span className="demo-sectionbar__desc">· 1 currently active</span>
          <span className="demo-sectionbar__spacer" />
          <button className="demo-btn demo-btn--ghost">Join with invite code</button>
        </div>

        <div className="demo-workspaces-grid">
          {WORKSPACES.map((w) => (
            <WorkspaceCard key={w.id} w={w} />
          ))}
          <NewWorkspaceCard />
        </div>
      </div>
    </div>
  );
}

function WorkspaceCard({ w }: { w: Workspace }) {
  const seatPct = Math.round((w.seatsUsed / w.seatsTotal) * 100);
  const progressTone =
    seatPct >= 90 ? "demo-progress--danger" : seatPct >= 70 ? "demo-progress--warn" : "demo-progress--accent";

  return (
    <div className={cn("demo-workspace", w.current && "is-current")}>
      <div
        className="demo-workspace__cover"
        style={{ backgroundImage: `linear-gradient(135deg, ${w.accent.from} 0%, ${w.accent.to} 100%)` }}
      >
        <span className="demo-workspace__cover-noise" aria-hidden />
        <span className="demo-workspace__glyph">{initials(w.name)}</span>
        {w.current && (
          <span className="demo-workspace__current">
            <Check size={10} strokeWidth={3} /> Current
          </span>
        )}
      </div>

      <div className="demo-workspace__body">
        <div className="demo-workspace__head">
          <div className="demo-workspace__name">{w.name}</div>
          <div className="demo-workspace__meta">
            <span className="demo-badge">{w.role}</span>
            <span className="demo-workspace__meta-sep" aria-hidden>·</span>
            <span>{w.plan}{w.cycle ? ` · ${w.cycle}` : ""}</span>
          </div>
        </div>

        <div className="demo-workspace__stat">
          <div className="demo-workspace__stat-row">
            <span>Seats</span>
            <span className="demo-workspace__stat-num">
              {w.seatsUsed}<span className="demo-workspace__stat-total">/{w.seatsTotal}</span>
            </span>
          </div>
          <div className={cn("demo-progress", progressTone)}>
            <div className="demo-progress__bar">
              <div className="demo-progress__fill" style={{ width: `${seatPct}%` }} />
            </div>
          </div>
        </div>

        <div className="demo-workspace__foot">
          <Avatars names={w.members} />
          <span className="demo-workspace__visited">Visited {w.lastVisited}</span>
        </div>

        {w.current ? (
          <button type="button" className="demo-btn demo-btn--ghost demo-btn--block" disabled>
            <Check size={13} strokeWidth={2} /> You are here
          </button>
        ) : (
          <button type="button" className="demo-btn demo-btn--primary demo-btn--block">
            Switch to this workspace <ArrowRight size={13} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </div>
  );
}

function NewWorkspaceCard() {
  return (
    <button type="button" className="demo-workspace demo-workspace--new">
      <div className="demo-workspace__new-inner">
        <span className="demo-workspace__new-icon"><Plus size={18} strokeWidth={1.8} /></span>
        <div>
          <div className="demo-workspace__new-title">Create a new workspace</div>
          <div className="demo-workspace__new-hint">Separate billing, members, and settings.</div>
        </div>
      </div>
    </button>
  );
}
