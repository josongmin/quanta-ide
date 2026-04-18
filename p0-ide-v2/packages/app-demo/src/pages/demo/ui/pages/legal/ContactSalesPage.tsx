import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Quote,
  ScrollText,
  ServerCog,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface InterestOption {
  value: string;
  label: string;
  Icon: typeof BadgeCheck;
}

const INTERESTS: InterestOption[] = [
  { value: "policy", label: "Policy & compliance", Icon: Stamp },
  { value: "onprem", label: "On-prem deployment", Icon: ServerCog },
  { value: "soc2", label: "SOC2 evidence", Icon: ShieldCheck },
  { value: "licensing", label: "Volume licensing", Icon: BadgeCheck },
  { value: "review", label: "Security review", Icon: ScrollText },
];

const TRUST_BADGES = ["SOC 2 Type II", "ISO 27001", "HIPAA", "GDPR", "DPA"];

const METRICS = [
  { n: "200+", k: "Enterprises" },
  { n: "99.99%", k: "Uptime" },
  { n: "12min", k: "Median response" },
];

const COMPLIANCE_MATRIX = ["SOC2 Type II", "ISO 27001", "HIPAA", "GDPR (DPA)"];

export function ContactSalesPage() {
  const [interest, setInterest] = useState("policy");
  const [teamSize, setTeamSize] = useState("51-200");
  const [industry, setIndustry] = useState("fintech");
  const [nda, setNda] = useState(false);
  const [compliance, setCompliance] = useState<Record<string, boolean>>({
    "SOC2 Type II": true,
    "ISO 27001": false,
    HIPAA: false,
    "GDPR (DPA)": true,
  });

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Legal & help"
        title="Talk to our Enterprise team"
        sub="We'll reply within one business day. Kick off with a 30-minute scoping call, or jump straight to a pilot."
      />
      <div className="demo-app__body">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr",
            gap: "var(--space-6)",
            maxWidth: 1080,
          }}
        >
          {/* ─── Left: Form ─── */}
          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div>
              <div
                style={{
                  fontSize: "var(--fs-10)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: "var(--fw-bold)",
                  color: "var(--fg-subtle)",
                  marginBottom: "var(--space-1h)",
                }}
              >
                Tell us about your team
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "var(--fs-lg)",
                  fontWeight: "var(--fw-bold)",
                  letterSpacing: "-0.01em",
                }}
              >
                Scoping questionnaire
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
              }}
            >
              <div className="demo-field">
                <label className="demo-field__label">First name</label>
                <input className="demo-input" defaultValue="June" />
              </div>
              <div className="demo-field">
                <label className="demo-field__label">Last name</label>
                <input className="demo-input" defaultValue="Huh" />
              </div>
            </div>

            <div className="demo-field">
              <label className="demo-field__label">Work email</label>
              <input className="demo-input" type="email" defaultValue="june@mercator.co" />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
              }}
            >
              <div className="demo-field">
                <label className="demo-field__label">Company name</label>
                <input className="demo-input" defaultValue="Mercator" />
              </div>
              <div className="demo-field">
                <label className="demo-field__label">Company website</label>
                <input className="demo-input" defaultValue="https://mercator.co" />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
              }}
            >
              <div className="demo-field">
                <label className="demo-field__label">Team size</label>
                <select
                  className="demo-select"
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                >
                  <option value="1-10">1–10</option>
                  <option value="11-50">11–50</option>
                  <option value="51-200">51–200</option>
                  <option value="201-1000">201–1000</option>
                  <option value="1000+">1000+</option>
                </select>
              </div>
              <div className="demo-field">
                <label className="demo-field__label">Industry</label>
                <select
                  className="demo-select"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  <option value="fintech">Fintech</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="gov">Gov</option>
                  <option value="infra">Infra</option>
                  <option value="devtools">Dev tools</option>
                  <option value="gaming">Gaming</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="demo-field">
              <label className="demo-field__label">Primary interest</label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                  marginTop: 4,
                }}
              >
                {INTERESTS.map((opt) => {
                  const selected = interest === opt.value;
                  const Icon = opt.Icon;
                  return (
                    <label
                      key={opt.value}
                      style={{
                        position: "relative",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected ? "var(--bg-accent-subtle)" : "var(--bg)",
                        color: selected ? "var(--accent)" : "var(--fg)",
                        borderRadius: "var(--radius-pill)",
                        fontSize: "var(--fs-xs)",
                        fontWeight: "var(--fw-medium)",
                        cursor: "pointer",
                        transition: "all 0.14s ease",
                      }}
                    >
                      <input
                        type="radio"
                        name="interest"
                        value={opt.value}
                        checked={selected}
                        onChange={() => setInterest(opt.value)}
                        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                      />
                      <Icon size={12} strokeWidth={2} />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
              }}
            >
              <div className="demo-field">
                <label className="demo-field__label">Estimated go-live</label>
                <input className="demo-input" type="month" defaultValue="2026-09" />
              </div>
              <div className="demo-field">
                <label className="demo-field__label">Headquarters</label>
                <input className="demo-input" defaultValue="Seoul, KR" />
              </div>
            </div>

            <div className="demo-field">
              <label className="demo-field__label">Message</label>
              <textarea
                className="demo-textarea"
                rows={4}
                defaultValue="We're evaluating Quanta for our core platform monorepo (~1.2M LOC). Main goals: policy enforcement across 28 services, SOC2 evidence pipeline, and on-prem deployment for our EU region."
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: "var(--fs-xs)",
                  fontWeight: "var(--fw-semibold)",
                  color: "var(--fg)",
                  marginBottom: "var(--space-2)",
                }}
              >
                Compliance programs we need to satisfy
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-3)",
                }}
              >
                {COMPLIANCE_MATRIX.map((label) => (
                  <label
                    key={label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!compliance[label]}
                      onChange={(e) =>
                        setCompliance((m) => ({ ...m, [label]: e.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: "var(--fs-xs)",
                color: "var(--fg-muted)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={nda}
                onChange={(e) => setNda(e.target.checked)}
              />
              Send me a mutual NDA before the first call
            </label>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                marginTop: "var(--space-2)",
              }}
            >
              <button className="demo-btn demo-btn--primary">
                Book a call <ArrowRight size={13} strokeWidth={1.8} />
              </button>
              <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>
                By submitting you agree to our Terms & Privacy.
              </span>
            </div>
          </section>

          {/* ─── Right: Trust rail ─── */}
          <aside style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            {/* Testimonial */}
            <div
              style={{
                padding: "var(--space-4)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2h)",
              }}
            >
              <Quote
                size={18}
                strokeWidth={1.5}
                style={{ color: "var(--accent-purple)" }}
              />
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--fs-md)",
                  lineHeight: "var(--lh-relaxed)",
                  letterSpacing: "-0.005em",
                }}
              >
                &ldquo;We replaced three tools with Quanta and cut our policy-review time from
                two days to two hours.&rdquo;
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginTop: "var(--space-1h)",
                }}
              >
                <span className="demo-avatar">JH</span>
                <div>
                  <div
                    style={{
                      fontSize: "var(--fs-xs)",
                      fontWeight: "var(--fw-semibold)",
                    }}
                  >
                    June Huh
                  </div>
                  <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>
                    VP Eng · Mercator
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div
              style={{
                padding: "var(--space-4)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "var(--space-3)",
                textAlign: "center",
              }}
            >
              {METRICS.map((m) => (
                <div key={m.k}>
                  <div
                    style={{
                      fontSize: "var(--fs-xl)",
                      fontWeight: "var(--fw-bold)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {m.n}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--fs-10)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--fg-subtle)",
                      marginTop: 2,
                    }}
                  >
                    {m.k}
                  </div>
                </div>
              ))}
            </div>

            {/* Trust badges */}
            <div
              style={{
                padding: "var(--space-4)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--fs-10)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: "var(--fw-bold)",
                  color: "var(--fg-subtle)",
                  marginBottom: "var(--space-2h)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ShieldCheck size={12} strokeWidth={2} />
                Compliance & security
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                }}
              >
                {TRUST_BADGES.map((b) => (
                  <span
                    key={b}
                    style={{
                      padding: "6px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-pill)",
                      fontSize: "var(--fs-10)",
                      fontWeight: "var(--fw-semibold)",
                      color: "var(--fg-muted)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>
              <p
                style={{
                  margin: "var(--space-3) 0 0 0",
                  fontSize: "var(--fs-10)",
                  color: "var(--fg-subtle)",
                }}
              >
                Current reports available under NDA.
              </p>
            </div>

            {/* Extra: Direct contact strip */}
            <div
              style={{
                padding: "var(--space-3h) var(--space-4)",
                border: "1px dashed var(--border)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--bg-subtle)",
              }}
            >
              <Building2
                size={16}
                strokeWidth={1.8}
                style={{ color: "var(--fg-muted)", flexShrink: 0 }}
              />
              <div
                style={{
                  fontSize: "var(--fs-xs)",
                  color: "var(--fg-muted)",
                  lineHeight: "var(--lh-relaxed)",
                }}
              >
                Prefer to skip the form? Reach our team directly at{" "}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--accent)",
                  }}
                >
                  sales@quanta.dev
                </span>
                .
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
