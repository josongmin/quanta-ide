import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Lightbulb, Rocket, X } from "lucide-react";
import { useDemoNav } from "../../DemoPage";

interface Step { id: string; title: string; desc: string; cta: string; target?: string; }

const FEATURED: Step[] = [
  { id: "workspace", title: "Create your workspace",   desc: "Give your org a name and invite teammates.",                    cta: "Open workspaces",   target: "team.workspaces" },
  { id: "repo",      title: "Connect a repository",    desc: "Link a GitHub / GitLab repo to start the first analysis.",      cta: "Connect repo" },
  { id: "sample",    title: "Run a sample analysis",   desc: "We'll walk you through risk, blast, and taint signals.",        cta: "Take the tour" },
  { id: "invite",    title: "Invite a teammate",       desc: "Flows are better with two people. Bring someone along.",        cta: "Send invite",       target: "team.invites" },
];

const FOLLOW_UP: Step[] = [
  { id: "policy",    title: "Write your first policy", desc: "Pick a template — compliance, perf, or security.",              cta: "Open policies" },
  { id: "billing",   title: "(Optional) Choose a plan",desc: "Enable Team features when you're ready.",                       cta: "See plans",         target: "billing.pricing" },
];

const ALL_STEPS: Step[] = [...FEATURED, ...FOLLOW_UP];

export function OnboardingPage() {
  const nav = useDemoNav();
  const [done, setDone] = useState<Record<string, boolean>>({ workspace: true, repo: true });
  const [bannerOpen, setBannerOpen] = useState(true);
  const featuredDone = FEATURED.filter((s) => done[s.id]).length;

  const toggle = (id: string) => setDone((d) => ({ ...d, [id]: !d[id] }));
  const handleCard = (s: Step) => {
    if (s.target) nav.navigate(s.target);
    else toggle(s.id);
  };

  const completedAll = ALL_STEPS.filter((s) => done[s.id]).length;
  const pct = Math.round((completedAll / ALL_STEPS.length) * 100);

  return (
    <div className="demo-app">
      <header className="demo-welcome">
        <div className="demo-welcome__intro">
          <span className="demo-welcome__kicker">Let's get started</span>
          <h1 className="demo-welcome__title">
            Welcome to <em>Quanta</em>
          </h1>
          <div className="demo-welcome__progress" role="status" aria-live="polite">
            <span className="demo-welcome__dots" aria-hidden>
              {FEATURED.map((s) => (
                <span
                  key={s.id}
                  className={"demo-welcome__dot" + (done[s.id] ? " is-done" : "")}
                />
              ))}
            </span>
            <span>{featuredDone}/{FEATURED.length}</span>
          </div>
        </div>

        <div className="demo-welcome__cards" role="list">
          {FEATURED.map((s) => {
            const isDone = !!done[s.id];
            return (
              <button
                key={s.id}
                type="button"
                role="listitem"
                className={"demo-welcome-card" + (isDone ? " is-done" : "")}
                onClick={() => handleCard(s)}
                aria-pressed={isDone}
              >
                <div className="demo-welcome-card__title">{s.title}</div>
                <div className="demo-welcome-card__desc">{s.desc}</div>
                <span className="demo-welcome-card__corner" aria-hidden>
                  {isDone ? (
                    <Check size={28} strokeWidth={1.8} />
                  ) : (
                    <ArrowUpRight size={36} strokeWidth={1.2} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {bannerOpen ? (
        <div className="demo-welcome-banner" role="note">
          <span className="demo-welcome-banner__icon" aria-hidden>
            <Lightbulb size={15} strokeWidth={1.8} />
          </span>
          <span className="demo-welcome-banner__body">
            <span className="demo-welcome-banner__tag">New feature: Code Universe.</span>
            Map every function and edge in your workspace on a single canvas.
          </span>
          <button
            type="button"
            className="demo-welcome-banner__link"
            onClick={() => nav.navigate("team.workspaces")}
          >
            Try it now
          </button>
          <button
            type="button"
            className="demo-welcome-banner__close"
            aria-label="Dismiss announcement"
            onClick={() => setBannerOpen(false)}
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>
      ) : null}

      <div className="demo-app__body" style={{ paddingTop: 0 }}>
        <div className="demo-sectionbar">
          <div className="demo-sectionbar__title">Pick up where you left off</div>
          <div className="demo-sectionbar__desc">{completedAll} of {ALL_STEPS.length} · {pct}% complete</div>
        </div>

        <ul className="demo-checklist">
          {ALL_STEPS.map((s) => {
            const isDone = !!done[s.id];
            return (
              <li key={s.id} className={"demo-checklist__item" + (isDone ? " is-done" : "")}>
                <button
                  type="button"
                  className="demo-checklist__bullet"
                  onClick={() => toggle(s.id)}
                  aria-pressed={isDone}
                  aria-label={isDone ? `Mark "${s.title}" not done` : `Mark "${s.title}" done`}
                >
                  {isDone ? <Check size={13} strokeWidth={2.4} /> : <Rocket size={13} strokeWidth={1.8} />}
                </button>
                <div>
                  <div className="demo-checklist__title">{s.title}</div>
                  <div className="demo-checklist__desc">{s.desc}</div>
                </div>
                <button
                  className={isDone ? "demo-btn demo-btn--ghost" : "demo-btn demo-btn--primary"}
                  onClick={() => s.target && nav.navigate(s.target)}
                  disabled={isDone}
                >
                  {s.cta} <ArrowRight size={12} strokeWidth={1.8} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
