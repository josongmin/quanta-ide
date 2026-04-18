import { useState } from "react";
import { Check, Rocket, ArrowRight } from "lucide-react";
import { useDemoNav } from "../../DemoPage";

interface Step { id: string; title: string; desc: string; cta: string; target?: string; }

const STEPS: Step[] = [
  { id: "workspace", title: "Create your workspace",   desc: "Give your org a name and invite teammates.",                    cta: "Open workspaces",   target: "team.workspaces" },
  { id: "repo",      title: "Connect a repository",    desc: "Link a GitHub / GitLab repo to start the first analysis.",     cta: "Connect repo" },
  { id: "sample",    title: "Run a sample analysis",   desc: "We'll walk you through risk, blast, and taint signals.",        cta: "Take the tour" },
  { id: "invite",    title: "Invite a teammate",       desc: "Flows are better with two people. Bring someone along.",        cta: "Send invite",       target: "team.invites" },
  { id: "policy",    title: "Write your first policy", desc: "Pick a template — compliance, perf, or security.",              cta: "Open policies" },
  { id: "billing",   title: "(Optional) Choose a plan",desc: "Enable Team features when you're ready.",                       cta: "See plans",         target: "billing.pricing" },
];

export function OnboardingPage() {
  const nav = useDemoNav();
  const [done, setDone] = useState<Record<string, boolean>>({ workspace: true, repo: true });
  const completed = STEPS.filter((s) => done[s.id]).length;
  const pct = Math.round((completed / STEPS.length) * 100);

  const toggle = (id: string) => setDone((d) => ({ ...d, [id]: !d[id] }));

  return (
    <div className="demo-app">
      <header className="demo-app__hero">
        <span className="demo-app__hero-kicker">Onboarding</span>
        <h1 className="demo-app__hero-title">Getting started with Quanta</h1>
        <p className="demo-app__hero-sub">
          Finish the checklist to unlock the full workspace. You can always pick this up later from the help menu.
        </p>
      </header>
      <div className="demo-app__body">
        <div className="demo-stats" style={{ marginBottom: 16 }}>
          <div className="demo-stat">
            <div className="demo-stat__label">Progress</div>
            <div className="demo-stat__value">{completed} / {STEPS.length}</div>
            <div className="demo-progress demo-progress--accent" style={{ marginTop: 8 }}>
              <div className="demo-progress__bar"><div className="demo-progress__fill" style={{ width: `${pct}%` }} /></div>
            </div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Estimated time</div>
            <div className="demo-stat__value">~6 min</div>
            <div className="demo-stat__delta">Average across 1,200 teams.</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Rewards</div>
            <div className="demo-stat__value">14-day trial</div>
            <div className="demo-stat__delta">Unlocks at 100%.</div>
          </div>
        </div>

        <ul className="demo-checklist">
          {STEPS.map((s) => {
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
