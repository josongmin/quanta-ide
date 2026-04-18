import { Sparkles } from "lucide-react";
import { useDemoNav } from "../../DemoPage";
import { DemoAppHero } from "../../internal/DemoAppHero";

export function UpgradePage() {
  const nav = useDemoNav();
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Billing"
        title="Upgrade prompt"
        sub="How a paywall modal looks in context — the darkened area is the app behind it."
      />
      <div className="demo-app__body">
        <div className="demo-modal-host">
          <div className="demo-modal-card">
            <div className="demo-modal-card__spark"><Sparkles size={22} strokeWidth={1.8} /></div>
            <h3>Unlock 50 parallel analysis runs</h3>
            <p>
              You&apos;ve hit the Free tier limit of 5 concurrent analysis workers. Upgrade to Team
              to run 50 in parallel, plus all intelligence engines and 30-day history.
            </p>
            <div className="demo-modal-card__actions">
              <button className="demo-btn demo-btn--ghost">Maybe later</button>
              <button className="demo-btn demo-btn--primary" onClick={() => nav.navigate("billing.pricing")}>
                See plans
              </button>
            </div>
            <p style={{ marginTop: 12, fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>
              14-day free trial · no card required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
