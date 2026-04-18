import { useState } from "react";
import { Plus, Check, CornerDownLeft, Search, Settings, MoreHorizontal } from "lucide-react";
import { cn } from "@quanta/ui-kit/lib";
import { Avatars } from "../../internal/Avatars";
import { initials } from "../../internal/avatar-utils";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface Workspace {
  id: string;
  name: string;
  handle: string;
  role: string;
  plan: string;
  cycle?: string;
  seatsUsed: number;
  seatsTotal: number;
  members: string[];
  lastVisited: string;
  accent: string;
  current?: boolean;
}

const WORKSPACES: Workspace[] = [
  {
    id: "acme",
    name: "Acme Inc.",
    handle: "acme",
    role: "Owner",
    plan: "Team",
    cycle: "Yearly",
    seatsUsed: 12,
    seatsTotal: 25,
    members: ["Ada Lovelace", "Alan Turing", "Grace Hopper", "Linus Torvalds", "Margaret Hamilton", "Donald Knuth"],
    lastVisited: "Just now",
    accent: "#7c6bf3",
    current: true,
  },
  {
    id: "oss",
    name: "Acme Open Source",
    handle: "acme-oss",
    role: "Admin",
    plan: "Free",
    seatsUsed: 4,
    seatsTotal: 10,
    members: ["Ada Lovelace", "Linus Torvalds", "Donald Knuth"],
    lastVisited: "2 days ago",
    accent: "#14b8a6",
  },
  {
    id: "labs",
    name: "Acme Labs",
    handle: "acme-labs",
    role: "Engineer",
    plan: "Team",
    cycle: "Monthly",
    seatsUsed: 7,
    seatsTotal: 10,
    members: ["Ada Lovelace", "Margaret Hamilton", "Grace Hopper", "Alan Turing"],
    lastVisited: "Last week",
    accent: "#f97316",
  },
  {
    id: "sandbox",
    name: "ada's sandbox",
    handle: "ada-sandbox",
    role: "Owner",
    plan: "Free",
    seatsUsed: 1,
    seatsTotal: 3,
    members: ["Ada Lovelace"],
    lastVisited: "3 hours ago",
    accent: "#ec4899",
  },
];

export function WorkspacesPage() {
  const [q, setQ] = useState("");
  const shown = WORKSPACES.filter(
    (w) => !q || w.name.toLowerCase().includes(q.toLowerCase()) || w.handle.includes(q.toLowerCase()),
  );

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Team"
        title="Workspaces"
        sub="Switch between organizations, or spin up a new workspace for a separate project or client."
      />
      <div className="demo-app__body">
        <div className="demo-ws-toolbar">
          <div className="demo-ws-toolbar__meta">
            <span className="demo-ws-toolbar__count">{WORKSPACES.length}</span>
            <span className="demo-ws-toolbar__label">workspaces</span>
            <span className="demo-ws-toolbar__sep" aria-hidden />
            <span className="demo-ws-toolbar__hint">1 active · Acme Inc.</span>
          </div>
          <span className="demo-sectionbar__spacer" />
          <label className="demo-ws-search">
            <Search size={13} strokeWidth={1.8} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter workspaces"
              aria-label="Filter workspaces"
            />
            <kbd className="demo-ws-search__kbd">/</kbd>
          </label>
          <button className="demo-btn demo-btn--ghost">Join with code</button>
        </div>

        <ul className="demo-ws-list" role="list">
          {shown.map((w, i) => (
            <WorkspaceRow key={w.id} w={w} idx={i} />
          ))}
          <NewWorkspaceRow />
        </ul>

        <div className="demo-ws-foot">
          <span>
            Press <kbd className="demo-ws-kbd">⌘</kbd>
            <kbd className="demo-ws-kbd">K</kbd> to jump between workspaces from anywhere.
          </span>
        </div>
      </div>
    </div>
  );
}

function WorkspaceRow({ w, idx }: { w: Workspace; idx: number }) {
  const seatPct = Math.round((w.seatsUsed / w.seatsTotal) * 100);
  const tone = seatPct >= 90 ? "danger" : seatPct >= 70 ? "warn" : "ok";

  return (
    <li
      className={cn("demo-ws-row", w.current && "is-current")}
      style={{ ["--ws-accent" as string]: w.accent }}
    >
      <div className="demo-ws-row__mono" aria-hidden>
        <span className="demo-ws-row__mono-tint" />
        <span className="demo-ws-row__mono-text">{initials(w.name)}</span>
      </div>

      <div className="demo-ws-row__main">
        <div className="demo-ws-row__head">
          <span className="demo-ws-row__name">{w.name}</span>
          <span className="demo-ws-row__handle">{w.handle}.quanta.dev</span>
          {w.current && (
            <span className="demo-ws-row__current-chip">
              <span className="demo-ws-row__current-dot" />
              Current
            </span>
          )}
        </div>
        <div className="demo-ws-row__sub">
          <span className="demo-badge demo-badge--accent">{w.role}</span>
          <span className="demo-ws-row__plan">
            {w.plan}
            {w.cycle ? ` · ${w.cycle}` : ""}
          </span>
          <span className="demo-ws-row__pipe" aria-hidden />
          <span className={cn("demo-ws-row__seats", `is-${tone}`)}>
            <span className="demo-ws-row__seats-bar" aria-hidden>
              <span style={{ width: `${seatPct}%` }} />
            </span>
            <span className="demo-ws-row__seats-num">
              {w.seatsUsed}
              <span className="demo-ws-row__seats-of">/{w.seatsTotal}</span>
            </span>
            <span className="demo-ws-row__seats-label">seats</span>
          </span>
          <span className="demo-ws-row__pipe" aria-hidden />
          <Avatars names={w.members} max={4} />
          <span className="demo-ws-row__pipe" aria-hidden />
          <span className="demo-ws-row__visited">Visited {w.lastVisited}</span>
        </div>
      </div>

      <div className="demo-ws-row__aside">
        {idx < 9 && (
          <kbd className="demo-ws-kbd demo-ws-kbd--combo">
            <span>⌘</span>
            <span>{idx + 1}</span>
          </kbd>
        )}
        {w.current ? (
          <span className="demo-ws-row__status">
            <Check size={13} strokeWidth={2.2} /> Here
          </span>
        ) : (
          <span className="demo-ws-row__switch">
            <span className="demo-ws-row__switch-label">Switch</span>
            <CornerDownLeft size={13} strokeWidth={1.8} />
          </span>
        )}
        <button type="button" className="demo-ws-row__more" aria-label={`${w.name} actions`}>
          {w.current ? <Settings size={14} strokeWidth={1.8} /> : <MoreHorizontal size={14} strokeWidth={1.8} />}
        </button>
      </div>
    </li>
  );
}

function NewWorkspaceRow() {
  return (
    <li className="demo-ws-row demo-ws-row--new">
      <button type="button" className="demo-ws-row__new-btn">
        <span className="demo-ws-row__new-icon">
          <Plus size={16} strokeWidth={2} />
        </span>
        <span className="demo-ws-row__new-text">
          <span className="demo-ws-row__new-title">Create a new workspace</span>
          <span className="demo-ws-row__new-hint">Separate billing, members, and settings.</span>
        </span>
        <span className="demo-ws-row__new-kbd">
          <kbd className="demo-ws-kbd">⌘</kbd>
          <kbd className="demo-ws-kbd">N</kbd>
        </span>
      </button>
    </li>
  );
}
