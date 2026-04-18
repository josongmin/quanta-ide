import { LayoutDashboard, Check, ArrowRight, Rocket, GitBranch, Users, Shield, Compass } from "lucide-react";
import { useDemoNav } from "../../DemoPage";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface Step {
  id: string;
  title: string;
  desc: string;
  done: boolean;
  target?: string;
}

const STEPS: Step[] = [
  {
    id: "repo",
    title: "Connect your first repository",
    desc: "Link a GitHub or GitLab repo so we can start analyzing your code.",
    done: true,
    target: "team.workspaces",
  },
  {
    id: "invite",
    title: "Invite your teammates",
    desc: "Analyses are more useful when the whole team can see them.",
    done: false,
    target: "team.invites",
  },
  {
    id: "analysis",
    title: "Run your first analysis",
    desc: "Trigger a scan on your main branch to see risk, blast, and taint signals.",
    done: false,
  },
  {
    id: "policy",
    title: "Set up a policy rule",
    desc: "Pick a starter template — compliance, perf, or security.",
    done: false,
  },
];

interface Suggestion {
  label: string;
  blurb: string;
  icon: React.ReactNode;
  target: string;
}

const SUGGESTIONS: Suggestion[] = [
  { label: "Browse the catalog", blurb: "See every surface at a glance.", icon: <Compass size={16} strokeWidth={1.8} />,   target: "catalog" },
  { label: "Manage workspaces",  blurb: "Switch or create an org.",       icon: <GitBranch size={16} strokeWidth={1.8} />, target: "team.workspaces" },
  { label: "Explore roles",      blurb: "Review who can do what.",        icon: <Users size={16} strokeWidth={1.8} />,     target: "team.roles" },
];

export function EmptyDashboardPage() {
  const nav = useDemoNav();
  const completed = STEPS.filter((s) => s.done).length;

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Dashboard"
        title="Welcome to your workspace"
        sub="There's nothing here yet — let's change that."
      />

      <div className="demo-app__body">
        <div className="demo-empty" style={{ marginBottom: 16 }}>
          <LayoutDashboard size={24} strokeWidth={1.6} />
          <div className="demo-empty__title">Let&apos;s get you set up</div>
          <div className="demo-empty__hint">
            A few quick steps and your dashboard will start filling in. You&apos;ve finished {completed} of {STEPS.length}.
          </div>
        </div>

        <ul className="demo-checklist">
          {STEPS.map((s) => (
            <li key={s.id} className={"demo-checklist__item" + (s.done ? " is-done" : "")}>
              <span
                className="demo-checklist__bullet"
                aria-hidden
                style={{ pointerEvents: "none" }}
              >
                {s.done ? <Check size={13} strokeWidth={2.4} /> : <Rocket size={13} strokeWidth={1.8} />}
              </span>
              <div>
                <div className="demo-checklist__title">{s.title}</div>
                <div className="demo-checklist__desc">{s.desc}</div>
              </div>
              <button
                type="button"
                className={s.done ? "demo-btn demo-btn--ghost" : "demo-btn demo-btn--primary"}
                onClick={() => s.target && nav.navigate(s.target)}
                disabled={s.done || !s.target}
              >
                {s.done ? "Done" : "Start"} <ArrowRight size={12} strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>

        <div className="demo-sectionbar" style={{ marginTop: "var(--space-5)" }}>
          <span className="demo-catalog__card-icon" aria-hidden>
            <Shield size={16} strokeWidth={1.8} />
          </span>
          <div>
            <div className="demo-sectionbar__title">While you&apos;re waiting</div>
            <div className="demo-sectionbar__desc">Take a look around — nothing here writes data yet.</div>
          </div>
        </div>

        <div className="demo-grid-3" style={{ marginTop: 12 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.target}
              type="button"
              className="demo-catalog__card"
              onClick={() => nav.navigate(s.target)}
            >
              <div className="demo-catalog__card-head">
                <span className="demo-catalog__card-icon" aria-hidden>{s.icon}</span>
              </div>
              <div className="demo-catalog__card-title">{s.label}</div>
              <div className="demo-catalog__card-blurb">{s.blurb}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
