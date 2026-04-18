import {
  Award,
  Check,
  Clock,
  Dot,
  Mail,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface Step {
  title: string;
  body: string;
  Icon: typeof Mail;
}

const STEPS: Step[] = [
  {
    title: "Report",
    body: "Send a detailed write-up with repro steps, PoC, and impact — PGP encryption encouraged.",
    Icon: Mail,
  },
  {
    title: "Triage within 48h",
    body: "Our security team acknowledges, reproduces, and assigns a severity rating.",
    Icon: Clock,
  },
  {
    title: "Fix & verify",
    body: "We ship a patch, verify with you, and schedule a coordinated disclosure window.",
    Icon: ShieldCheck,
  },
  {
    title: "Reward & credit",
    body: "Bounty is paid and — with your consent — you're added to our hall of fame.",
    Icon: Award,
  },
];

type Tone = "danger" | "warn" | "accent" | "neutral";

interface Tier {
  severity: string;
  tone: Tone;
  min: string;
  max: string;
  description: string;
  examples: string[];
}

const TIERS: Tier[] = [
  {
    severity: "Critical",
    tone: "danger",
    min: "10,000",
    max: "50,000",
    description: "Full compromise of the platform or customer tenants.",
    examples: [
      "Remote code execution on production",
      "Authentication bypass across tenants",
      "Secret exfiltration from vault service",
    ],
  },
  {
    severity: "High",
    tone: "warn",
    min: "3,000",
    max: "10,000",
    description: "Significant exposure of sensitive data or privileges.",
    examples: [
      "Cross-tenant data exfiltration",
      "Privilege escalation to admin role",
      "Auth token replay without expiry",
    ],
  },
  {
    severity: "Medium",
    tone: "accent",
    min: "500",
    max: "3,000",
    description: "Bounded impact with realistic attack preconditions.",
    examples: [
      "Stored XSS in workspace views",
      "Server-side request forgery (SSRF)",
      "Misconfigured CORS on internal API",
    ],
  },
  {
    severity: "Low",
    tone: "neutral",
    min: "100",
    max: "500",
    description: "Hardening opportunities with limited real-world risk.",
    examples: [
      "Rate-limit bypass on public endpoints",
      "Information leakage in error responses",
      "Weak CSP header on marketing surface",
    ],
  },
];

const IN_SCOPE = [
  "app.quanta.dev",
  "api.quanta.dev",
  "MCP endpoints (mcp.quanta.dev)",
  "Official SDKs (JS, Python, Go)",
  "Desktop client (quanta-desktop)",
];

const OUT_OF_SCOPE = [
  "Social engineering of staff or customers",
  "Physical attacks on offices or datacenters",
  "Denial of service via traffic volume",
  "Third-party subprocessors (report to them directly)",
  "Findings on self-hosted or forked deployments",
];

const HALL_OF_FAME = [
  "Jade Park",
  "Haruto Ito",
  "Mei Zhang",
  "@0x5ec",
  "Elena Rossi",
  "@null_byte",
  "Ravi Menon",
  "Finn Adalbert",
];

function toneColor(tone: Tone): string {
  if (tone === "neutral") return "var(--fg-subtle)";
  return `var(--${tone})`;
}

export function SecurityDisclosurePage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Security"
        title="Responsible disclosure"
        sub="We welcome reports from security researchers. Here's how to reach us, what's in scope, and how we reward valid findings."
      />
      <div className="demo-app__body">
        {/* ─── Section 1: CTA strip ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "var(--space-4)",
            alignItems: "center",
            padding: "var(--space-5)",
            background:
              "linear-gradient(135deg, var(--bg-accent-subtle), var(--bg-subtle))",
            border: "1px solid var(--border-accent-subtle)",
            borderRadius: "var(--radius-lg)",
            marginBottom: "var(--space-5)",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: "var(--space-2)",
              }}
            >
              <ShieldCheck
                size={20}
                strokeWidth={1.8}
                style={{ color: "var(--accent)" }}
              />
              <span
                style={{
                  fontSize: "var(--fs-10)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: "var(--fw-bold)",
                  color: "var(--accent)",
                }}
              >
                Safe harbor
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: "var(--fs-xl)",
                fontWeight: "var(--fw-bold)",
                letterSpacing: "-0.01em",
              }}
            >
              Report a vulnerability
            </h2>
            <p
              style={{
                margin: "var(--space-1h) 0 0 0",
                color: "var(--fg-muted)",
                fontSize: "var(--fs-sm)",
                maxWidth: 520,
                lineHeight: "var(--lh-relaxed)",
              }}
            >
              Email{" "}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--accent)",
                }}
              >
                security@quanta.dev
              </span>{" "}
              — encrypt with our PGP key for sensitive details.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "stretch",
            }}
          >
            <button className="demo-btn demo-btn--primary">
              <Mail size={13} strokeWidth={1.8} /> Open a report
            </button>
            <button className="demo-btn demo-btn--ghost">
              Download PGP key (2048-bit)
            </button>
          </div>
        </div>

        {/* ─── Section 2: How it works ─── */}
        <section style={{ marginBottom: "var(--space-6)" }}>
          <h3
            style={{
              margin: "0 0 var(--space-3h) 0",
              fontSize: "var(--fs-lg)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "-0.01em",
            }}
          >
            How it works
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "var(--space-3h)",
            }}
          >
            {STEPS.map((step, i) => {
              const Icon = step.Icon;
              return (
                <div
                  key={step.title}
                  style={{
                    padding: "var(--space-4)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    position: "relative",
                    background: "var(--bg)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      left: -12,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "var(--fg)",
                      color: "var(--bg)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "var(--fw-bold)",
                      fontSize: "var(--fs-sm)",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--bg-muted)",
                      color: "var(--fg-muted)",
                      marginBottom: "var(--space-2h)",
                    }}
                  >
                    <Icon size={16} strokeWidth={1.8} />
                  </div>
                  <h4
                    style={{
                      margin: "0 0 4px 0",
                      fontSize: "var(--fs-sm)",
                      fontWeight: "var(--fw-semibold)",
                    }}
                  >
                    {step.title}
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg-muted)",
                      lineHeight: "var(--lh-relaxed)",
                    }}
                  >
                    {step.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Section 3: Bounty tiers ─── */}
        <section style={{ marginBottom: "var(--space-6)" }}>
          <h3
            style={{
              margin: "0 0 var(--space-3h) 0",
              fontSize: "var(--fs-lg)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "-0.01em",
            }}
          >
            Bounty rewards
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "var(--space-3)",
            }}
          >
            {TIERS.map((t) => {
              const color = toneColor(t.tone);
              const isDanger = t.tone === "danger";
              return (
                <div
                  key={t.severity}
                  style={{
                    padding: "var(--space-4h)",
                    border: `1px solid ${
                      isDanger ? "var(--danger)" : "var(--border)"
                    }`,
                    borderRadius: "var(--radius-md)",
                    background: isDanger
                      ? "var(--bg-danger-subtle)"
                      : "var(--bg)",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--fs-10)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: "var(--fw-bold)",
                      color,
                    }}
                  >
                    {t.severity}
                  </div>
                  <div
                    style={{
                      marginTop: "var(--space-1h)",
                      fontSize: "var(--fs-2xl)",
                      fontWeight: "var(--fw-bold)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    ${t.min}–${t.max}
                  </div>
                  <p
                    style={{
                      margin: "var(--space-2) 0 var(--space-2h) 0",
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg-muted)",
                      lineHeight: "var(--lh-relaxed)",
                    }}
                  >
                    {t.description}
                  </p>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg-muted)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {t.examples.map((e) => (
                      <li
                        key={e}
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "flex-start",
                        }}
                      >
                        <Dot
                          size={6}
                          strokeWidth={3}
                          style={{
                            color,
                            marginTop: 6,
                            flexShrink: 0,
                          }}
                        />
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Section 4: Scope ─── */}
        <section style={{ marginBottom: "var(--space-6)" }}>
          <h3
            style={{
              margin: "0 0 var(--space-3h) 0",
              fontSize: "var(--fs-lg)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "-0.01em",
            }}
          >
            Scope
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-3)",
            }}
          >
            <div
              style={{
                padding: "var(--space-4)",
                border: "1px solid var(--border-success-subtle)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-success-subtle)",
              }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: "var(--space-2h)",
                }}
              >
                <Check
                  size={16}
                  strokeWidth={2.4}
                  style={{ color: "var(--success)" }}
                />
                <h4
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-sm)",
                    fontWeight: "var(--fw-semibold)",
                  }}
                >
                  In scope
                </h4>
              </header>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-1h)",
                }}
              >
                {IN_SCOPE.map((s) => (
                  <li
                    key={s}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg)",
                    }}
                  >
                    <Check
                      size={12}
                      strokeWidth={2.4}
                      style={{
                        color: "var(--success)",
                        marginTop: 3,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily:
                          s.includes(".") && !s.includes(" ")
                            ? "var(--font-mono)"
                            : undefined,
                      }}
                    >
                      {s}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              style={{
                padding: "var(--space-4)",
                border: "1px solid var(--border-danger-subtle)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-danger-subtle)",
              }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: "var(--space-2h)",
                }}
              >
                <X
                  size={16}
                  strokeWidth={2.4}
                  style={{ color: "var(--danger)" }}
                />
                <h4
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-sm)",
                    fontWeight: "var(--fw-semibold)",
                  }}
                >
                  Out of scope
                </h4>
              </header>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-1h)",
                }}
              >
                {OUT_OF_SCOPE.map((s) => (
                  <li
                    key={s}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg)",
                    }}
                  >
                    <X
                      size={12}
                      strokeWidth={2.4}
                      style={{
                        color: "var(--danger)",
                        marginTop: 3,
                        flexShrink: 0,
                      }}
                    />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ─── Section 5: Hall of fame ─── */}
        <section style={{ marginTop: "var(--space-6)" }}>
          <h3
            style={{
              margin: "0 0 var(--space-1h) 0",
              fontSize: "var(--fs-lg)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "-0.01em",
            }}
          >
            Hall of fame
          </h3>
          <p
            style={{
              margin: 0,
              color: "var(--fg-muted)",
              fontSize: "var(--fs-sm)",
            }}
          >
            Researchers who've reported valid vulnerabilities (with their consent).
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-2)",
              marginTop: "var(--space-3)",
            }}
          >
            {HALL_OF_FAME.map((n) => (
              <span
                key={n}
                style={{
                  padding: "6px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-pill)",
                  fontSize: "var(--fs-10)",
                  color: "var(--fg-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--bg)",
                }}
              >
                <Star
                  size={11}
                  strokeWidth={1.8}
                  style={{ color: "var(--warn)" }}
                />
                {n}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
