import { useState } from "react";
import { Check } from "lucide-react";
import { useDemoNav } from "../../DemoPage";

const PLANS = [
  {
    id: "free",
    name: "Free",
    priceM: 0,
    priceY: 0,
    desc: "For individuals exploring the platform. Unlimited public repos, basic analysis.",
    features: [
      "1 workspace",
      "Up to 3 collaborators",
      "Community support",
      "Basic code intelligence",
      "7-day history",
    ],
    cta: "Continue with Free",
  },
  {
    id: "team",
    name: "Team",
    priceM: 19,
    priceY: 15,
    desc: "For growing engineering teams who need collaboration and deeper signals.",
    features: [
      "Unlimited workspaces",
      "Up to 25 seats",
      "All intelligence engines",
      "30-day history",
      "Priority email support",
      "SSO (Google + Microsoft)",
    ],
    cta: "Start free 14-day trial",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceM: null as number | null,
    priceY: null as number | null,
    desc: "For organizations with compliance, custom engines, or on-prem needs.",
    features: [
      "Unlimited seats",
      "SAML / OIDC SSO",
      "SCIM provisioning",
      "Custom retention",
      "Dedicated solutions engineer",
      "SOC 2 report + DPA",
    ],
    cta: "Contact sales",
  },
];

export function PricingPage() {
  const nav = useDemoNav();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("yearly");

  return (
    <div style={{ width: "100%", maxWidth: 1020, margin: "0 auto", padding: "var(--space-5) var(--space-4)", textAlign: "center" }}>
      <div className="demo-catalog__kicker">Pricing</div>
      <h1 className="demo-catalog__title" style={{ marginTop: 8 }}>
        Pick a plan that scales with your team.
      </h1>
      <p className="demo-catalog__sub" style={{ margin: "0 auto 24px" }}>
        Start free. Upgrade when you&apos;re ready. Every plan includes the full IDE experience —
        what changes is collaboration, retention, and enterprise controls.
      </p>

      <div className="demo-billing-toggle">
        <button className={cycle === "monthly" ? "is-active" : ""} onClick={() => setCycle("monthly")}>Monthly</button>
        <button className={cycle === "yearly" ? "is-active" : ""} onClick={() => setCycle("yearly")}>
          Yearly <span className="demo-badge demo-badge--success" style={{ marginLeft: 6 }}>-20%</span>
        </button>
      </div>

      <div className="demo-pricing" style={{ margin: "0 auto" }}>
        {PLANS.map((p) => {
          const price = cycle === "monthly" ? p.priceM : p.priceY;
          return (
            <div key={p.id} className={"demo-plan" + (p.popular ? " demo-plan--popular" : "")}>
              {p.popular && <span className="demo-plan__tag">Most popular</span>}
              <div className="demo-plan__name">{p.name}</div>
              <div className="demo-plan__price">
                {price == null ? (
                  <span className="demo-plan__price-num">Custom</span>
                ) : (
                  <>
                    <span className="demo-plan__price-num">${price}</span>
                    <span className="demo-plan__price-unit">/seat/mo</span>
                  </>
                )}
              </div>
              <div className="demo-plan__desc">{p.desc}</div>
              <ul className="demo-plan__features">
                {p.features.map((f) => (
                  <li key={f}>
                    <Check size={13} strokeWidth={2} /> {f}
                  </li>
                ))}
              </ul>
              <button
                className={p.popular ? "demo-btn demo-btn--primary" : "demo-btn demo-btn--ghost"}
                onClick={() => nav.navigate("billing.checkout")}
                style={{ marginTop: "auto" }}
              >
                {p.cta}
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 28, color: "var(--fg-subtle)", fontSize: "var(--fs-xs)" }}>
        Educational institutions and qualified open-source projects get Team free.{" "}
        <button className="demo-link" onClick={() => nav.navigate("legal.help")}>Learn more</button>.
      </p>
    </div>
  );
}
