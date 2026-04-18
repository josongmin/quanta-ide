import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AlertOctagon, AlertTriangle, Sparkles, X } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface ChromeProps {
  url: string;
  banner: ReactNode;
  disabled?: boolean;
}

function FakeChrome({ url, banner, disabled }: ChromeProps) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-subtle)",
        overflow: "hidden",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      {/* fake title bar */}
      <div
        style={{
          height: 28,
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-1h)",
          padding: "0 var(--space-3)",
          background: "var(--bg)",
        }}
      >
        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57", display: "inline-block" }} />
        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e", display: "inline-block" }} />
        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840", display: "inline-block" }} />
        <span
          style={{
            marginLeft: "var(--space-2)",
            fontSize: "var(--fs-10)",
            color: "var(--fg-subtle)",
            letterSpacing: "0.04em",
            fontFamily: "var(--font-mono)",
          }}
        >
          {url}
        </span>
      </div>

      {/* banner slot */}
      {banner}

      {/* fake page body */}
      <div
        style={{
          padding: "var(--space-5)",
          minHeight: 140,
          background: "var(--bg)",
          pointerEvents: disabled ? "none" : undefined,
          opacity: disabled ? 0.55 : 1,
          transition: "opacity 0.14s ease",
        }}
      >
        <div aria-hidden="true" style={{ height: 18, width: "40%", background: "var(--bg-muted)", borderRadius: "var(--radius-xs)", marginBottom: "var(--space-3)" }} />
        <div aria-hidden="true" style={{ height: 10, width: "80%", background: "var(--bg-muted)", borderRadius: "var(--radius-xs)", marginBottom: "var(--space-1h)" }} />
        <div aria-hidden="true" style={{ height: 10, width: "70%", background: "var(--bg-muted)", borderRadius: "var(--radius-xs)", marginBottom: "var(--space-4h)" }} />
        <div aria-hidden="true" style={{ height: 110, background: "var(--bg-muted)", borderRadius: "var(--radius-md)" }} />
      </div>
    </div>
  );
}

const BANNER_BASE: CSSProperties = {
  padding: "var(--space-2h) var(--space-4)",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2h)",
  fontSize: "var(--fs-xs)",
  color: "var(--fg)",
  lineHeight: "var(--lh-snug)",
};

function HealthyBanner() {
  return (
    <div
      style={{
        ...BANNER_BASE,
        background: "var(--bg-accent-subtle)",
        borderBottom: "1px solid var(--border-accent-subtle)",
      }}
    >
      <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" style={{ color: "var(--accent)", flex: "0 0 auto" }} />
      <span>
        Your <strong>Team trial</strong> has <strong>14 days</strong> remaining.
      </span>
      <span style={{ color: "var(--fg-subtle)" }}>Renews automatically on Oct 31, 2026.</span>
      <span style={{ marginLeft: "auto", display: "flex", gap: "var(--space-1h)", alignItems: "center" }}>
        <button
          type="button"
          className="demo-btn demo-btn--ghost"
          style={{ height: 24, padding: "0 var(--space-2)", fontSize: "var(--fs-10)" }}
        >
          See pricing
        </button>
        <DismissButton />
      </span>
    </div>
  );
}

function DismissButton() {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <button
      type="button"
      aria-label="Dismiss"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: 24,
        height: 24,
        border: 0,
        background: hover ? "var(--bg-hover)" : "transparent",
        cursor: "pointer",
        color: hover ? "var(--fg)" : "var(--fg-subtle)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        outline: focus ? "2px solid var(--accent)" : "none",
        outlineOffset: 2,
        transition: "background 0.14s ease, color 0.14s ease",
      }}
    >
      <X size={13} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

function WarnBanner() {
  return (
    <div
      style={{
        ...BANNER_BASE,
        background: "var(--bg-warn-subtle)",
        borderBottom: "1px solid var(--border-warn-subtle)",
      }}
    >
      <AlertTriangle size={14} strokeWidth={1.8} aria-hidden="true" style={{ color: "var(--warn)", flex: "0 0 auto" }} />
      <span>
        Your trial ends in <strong>3 days</strong>. Add a payment method to avoid interruption.
      </span>
      <span style={{ marginLeft: "auto", display: "flex", gap: "var(--space-1h)", alignItems: "center" }}>
        <button
          type="button"
          className="demo-btn demo-btn--ghost"
          style={{ height: 24, padding: "0 var(--space-2h)", fontSize: "var(--fs-10)" }}
        >
          Remind me tomorrow
        </button>
        <button
          type="button"
          className="demo-btn demo-btn--primary"
          style={{ height: 24, padding: "0 var(--space-2h)", fontSize: "var(--fs-10)" }}
        >
          Add payment method
        </button>
      </span>
    </div>
  );
}

function ExpiredBanner() {
  return (
    <div
      style={{
        ...BANNER_BASE,
        background: "var(--bg-danger-subtle)",
        borderBottom: "1px solid var(--border-danger-subtle)",
      }}
    >
      <AlertOctagon size={14} strokeWidth={1.8} aria-hidden="true" style={{ color: "var(--danger)", flex: "0 0 auto" }} />
      <span>
        Your trial <strong>expired on Oct 12</strong>. Upgrade to keep running analyses.
      </span>
      <span style={{ marginLeft: "auto", display: "flex", gap: "var(--space-1h)", alignItems: "center" }}>
        <button
          type="button"
          className="demo-btn demo-btn--ghost"
          style={{ height: 24, padding: "0 var(--space-2h)", fontSize: "var(--fs-10)" }}
        >
          Contact sales
        </button>
        <button
          type="button"
          className="demo-btn demo-btn--primary"
          style={{ height: 24, padding: "0 var(--space-2h)", fontSize: "var(--fs-10)" }}
        >
          Upgrade now
        </button>
      </span>
    </div>
  );
}

interface VariantSectionProps {
  kicker: string;
  title: string;
  sub: string;
  banner: ReactNode;
  disabled?: boolean;
}

function VariantSection({ kicker, title, sub, banner, disabled }: VariantSectionProps) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <span
          style={{
            fontSize: "var(--fs-10)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: "var(--fw-bold)",
            color: "var(--fg-subtle)",
          }}
        >
          {kicker}
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--fs-lg)",
            fontWeight: "var(--fw-semibold)",
            letterSpacing: "-0.01em",
            color: "var(--fg)",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-xs)",
            color: "var(--fg-muted)",
            lineHeight: "var(--lh-relaxed)",
          }}
        >
          {sub}
        </p>
      </header>
      <FakeChrome url="quanta.dev/app" banner={banner} disabled={disabled} />
    </section>
  );
}

interface PropRow {
  variant: string;
  tone: string;
  threshold: string;
  dismissible: string;
  blocking: string;
  badge: "accent" | "warn" | "danger";
}

const PROP_ROWS: PropRow[] = [
  { variant: "Healthy",  tone: "accent", threshold: "≥ 7 days left", dismissible: "yes", blocking: "no",  badge: "accent" },
  { variant: "Warning",  tone: "warn",   threshold: "1–6 days left", dismissible: "no",  blocking: "no",  badge: "warn" },
  { variant: "Expired",  tone: "danger", threshold: "past due",      dismissible: "no",  blocking: "yes", badge: "danger" },
];

export function TrialBannerPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="States & errors"
        title="Trial countdown banner"
        sub="Three tones, three placements. Shown here in a simulated app shell so you can see them in context."
      />
      <div className="demo-app__body">

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          <VariantSection
            kicker="Variant 01"
            title="Healthy — 14 days left"
            sub="Subtle, dismissible info banner. Appears at the top of the shell but never interrupts flow."
            banner={<HealthyBanner />}
          />

          <VariantSection
            kicker="Variant 02"
            title="Warning — 3 days left"
            sub="Warn tone, non-dismissible, nudges toward adding a payment method. Primary CTA inline."
            banner={<WarnBanner />}
          />

          <VariantSection
            kicker="Variant 03"
            title="Expired — blocking"
            sub="Danger tone with the body dimmed and interaction-blocked. Only upgrade / contact actions remain reachable."
            banner={<ExpiredBanner />}
            disabled
          />
        </div>

        {/* Props / variant matrix */}
        <div className="demo-block" style={{ marginTop: "var(--space-6)" }}>
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Props</div>
              <div className="demo-block__sub">
                &lt;TrialBanner variant tone threshold dismissible blocking /&gt;
              </div>
            </div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Tone</th>
                  <th>Threshold</th>
                  <th>Dismissible</th>
                  <th>Blocking</th>
                </tr>
              </thead>
              <tbody>
                {PROP_ROWS.map((r) => (
                  <tr key={r.variant}>
                    <td>
                      <span className={`demo-badge demo-badge--${r.badge}`}>{r.variant}</span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}>{r.tone}</td>
                    <td>{r.threshold}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}>{r.dismissible}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}>{r.blocking}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
