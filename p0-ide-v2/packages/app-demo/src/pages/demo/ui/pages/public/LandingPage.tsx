import { useMemo, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import {
  ArrowRight,
  AtSign,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Globe,
  LayoutDashboard,
  Lock,
  Mail,
  Play,
  Quote,
  Share2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Waypoints,
  Zap,
} from "lucide-react";
import { DarkPanel, DarkPanelBody, DarkPanelHeader } from "../../internal/DarkPanel";
import { StepCircle } from "../../internal/StepCircle";
import { useDemoNav } from "../../DemoPage";

/* ─────────────────────────────────────────────────────────────────────
   Tiny deterministic PRNG (seeded LCG) so visuals stay stable.
   ───────────────────────────────────────────────────────────────────── */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/* ─────────────────────────────────────────────────────────────────────
   Shared section wrapper — keeps every section centered + same width.
   ───────────────────────────────────────────────────────────────────── */
function Section({
  children,
  style,
  maxWidth = 1120,
}: {
  children: ReactNode;
  style?: CSSProperties;
  maxWidth?: number;
}): JSX.Element {
  return (
    <section
      style={{
        width: "100%",
        maxWidth,
        margin: "0 auto",
        padding: "0 var(--space-5)",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Tiny Q-glyph used in the nav (matches <Brand /> glyph style).
   ───────────────────────────────────────────────────────────────────── */
function QGlyph(): JSX.Element {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: "var(--radius-sm)",
        background: "var(--fg)",
        color: "var(--bg)",
        fontFamily: "var(--font-mono)",
        fontWeight: 800,
        fontSize: 15,
        letterSpacing: "-0.02em",
      }}
    >
      q
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Hero canvas — a fake Code Universe SVG map, 40+ nodes with edges.
   ───────────────────────────────────────────────────────────────────── */
interface CanvasNode {
  x: number;
  y: number;
  r: number;
  tone: "ok" | "warn" | "danger" | "hot";
}

function buildCanvasNodes(): { nodes: CanvasNode[]; edges: [number, number][] } {
  const rand = lcg(4269);
  const nodes: CanvasNode[] = [];
  const W = 100;
  const H = 62;
  const COUNT = 46;
  for (let i = 0; i < COUNT; i++) {
    const x = 4 + rand() * (W - 8);
    const y = 4 + rand() * (H - 8);
    const r = 1.4 + rand() * 2.6;
    const pick = rand();
    const tone: CanvasNode["tone"] =
      pick < 0.08 ? "hot" : pick < 0.22 ? "danger" : pick < 0.44 ? "warn" : "ok";
    nodes.push({ x, y, r, tone });
  }
  const edges: [number, number][] = [];
  for (let i = 0; i < COUNT; i++) {
    const neighbors = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < neighbors; k++) {
      const j = Math.floor(rand() * COUNT);
      if (j !== i) edges.push([i, j]);
    }
  }
  return { nodes, edges };
}

function HeroCanvas(): JSX.Element {
  const { nodes, edges } = useMemo(() => buildCanvasNodes(), []);
  return (
    <div
      style={{
        boxShadow: "var(--shadow-md)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        aspectRatio: "16 / 10",
        background: "linear-gradient(180deg, var(--bg-subtle) 0%, var(--bg) 100%)",
        padding: "var(--space-4)",
        border: "1px solid var(--border)",
        position: "relative",
      }}
    >
      <svg
        viewBox="0 0 100 62"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ display: "block" }}
        aria-hidden
      >
        {/* Edges */}
        {edges.map(([a, b], idx) => {
          const na = nodes[a]!;
          const nb = nodes[b]!;
          return (
            <line
              key={idx}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke="var(--border)"
              strokeWidth={0.15}
              opacity={0.55}
            />
          );
        })}
        {/* Node halos for hot spots */}
        {nodes.map((n, i) =>
          n.tone === "hot" ? (
            <circle
              key={`halo-${i}`}
              cx={n.x}
              cy={n.y}
              r={n.r * 2.8}
              fill="var(--accent)"
              opacity={0.14}
            />
          ) : null,
        )}
        {/* Nodes */}
        {nodes.map((n, i) => {
          const fill =
            n.tone === "hot"
              ? "var(--accent)"
              : n.tone === "danger"
                ? "var(--danger)"
                : n.tone === "warn"
                  ? "var(--warn)"
                  : "var(--fg-muted)";
          return (
            <circle
              key={`n-${i}`}
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={fill}
              stroke="var(--bg)"
              strokeWidth={0.3}
            />
          );
        })}
      </svg>
      {/* Top-left corner label */}
      <div
        style={{
          position: "absolute",
          top: "var(--space-3)",
          left: "var(--space-3)",
          padding: "2px var(--space-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-pill)",
          background: "color-mix(in srgb, var(--bg) 88%, transparent)",
          backdropFilter: "blur(6px)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-10)",
          color: "var(--fg-muted)",
          letterSpacing: "0.06em",
        }}
      >
        acme/order-service · canvas
      </div>
      {/* Bottom legend */}
      <div
        style={{
          position: "absolute",
          bottom: "var(--space-3)",
          left: "var(--space-3)",
          display: "flex",
          gap: "var(--space-3)",
          padding: "var(--space-1h) var(--space-3)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-pill)",
          background: "color-mix(in srgb, var(--bg) 88%, transparent)",
          backdropFilter: "blur(6px)",
          fontSize: "var(--fs-10)",
          color: "var(--fg-muted)",
          alignItems: "center",
        }}
      >
        <LegendDot color="var(--fg-muted)" label="healthy" />
        <LegendDot color="var(--warn)" label="watch" />
        <LegendDot color="var(--danger)" label="risk" />
        <LegendDot color="var(--accent)" label="hotspot" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }): JSX.Element {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
        }}
      />
      {label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Feature tile (6-up strip).
   ───────────────────────────────────────────────────────────────────── */
interface FeatureTile {
  title: string;
  desc: string;
  Icon: typeof Sparkles;
}

const FEATURES: readonly FeatureTile[] = [
  {
    title: "Code Universe",
    desc: "See every function and its blast radius on one map.",
    Icon: LayoutDashboard,
  },
  {
    title: "Intelligence engines",
    desc: "Risk, blast, taint, behavior, incidents — updated every push.",
    Icon: Waypoints,
  },
  {
    title: "Policies that ship",
    desc: "Write in plain YAML. Enforce in CI. Explain in PRs.",
    Icon: ShieldCheck,
  },
  {
    title: "Agent that reads the whole workspace",
    desc: "Refactor a module. Generate a policy. Explain an incident.",
    Icon: Sparkles,
  },
  {
    title: "MCP + CLI + API",
    desc: "Everything you click is scriptable.",
    Icon: Terminal,
  },
  {
    title: "Private by default",
    desc: "Your code is never used for training. SOC 2 + ISO 27001.",
    Icon: Lock,
  },
];

function FeatureCard({ tile }: { tile: FeatureTile }): JSX.Element {
  const [hover, setHover] = useState(false);
  const Icon = tile.Icon;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2h)",
        padding: "var(--space-5) var(--space-4h)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg)",
        transition: "border-color 0.14s ease, transform 0.14s ease, box-shadow 0.14s ease",
        borderColor: hover ? "var(--border-strong)" : "var(--border)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hover ? "var(--shadow-md)" : "none",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--radius-md)",
          background: "var(--bg-accent-subtle)",
          color: "var(--accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: "var(--fw-bold)",
          letterSpacing: "-0.01em",
          lineHeight: 1.25,
        }}
      >
        {tile.title}
      </div>
      <div
        style={{
          fontSize: "var(--fs-sm)",
          color: "var(--fg-muted)",
          lineHeight: "var(--lh-relaxed)",
        }}
      >
        {tile.desc}
      </div>
      <div
        style={{
          marginTop: "auto",
          fontSize: "var(--fs-xs)",
          color: "var(--accent)",
          fontWeight: "var(--fw-semibold)",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        Learn more <ArrowRight size={12} strokeWidth={2} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Step row — "How it works".
   ───────────────────────────────────────────────────────────────────── */
interface StepItem {
  title: string;
  desc: string;
}

const STEPS: readonly StepItem[] = [
  { title: "Connect your repo", desc: "GitHub, GitLab, or Bitbucket — read-only, 60-second install." },
  { title: "Open the canvas", desc: "We map every function and edge in your workspace within minutes." },
  { title: "Ship policies", desc: "Every PR gets a Quanta verdict — explained, auditable, overridable." },
];

/* ─────────────────────────────────────────────────────────────────────
   Interactive demo tabs.
   ───────────────────────────────────────────────────────────────────── */
type DemoTab = "risk" | "blast" | "taint" | "explain";

interface DemoSnippet {
  id: DemoTab;
  label: string;
  title: string;
  code: string;
  result: string;
}

const DEMOS: readonly DemoSnippet[] = [
  {
    id: "risk",
    label: "Risk score",
    title: "quanta risk score src/payments/charge.ts:applyDiscount",
    code: "$ quanta risk score src/payments/charge.ts:applyDiscount",
    result:
      "▸ risk:       HIGH (0.83)\n▸ why:        mutates shared cart state; depended on by 14 callers\n▸ hotspot:    src/payments/charge.ts:applyDiscount (last changed 3 days ago)\n▸ suggests:   extract pure helper, add property test in payments.discount.spec.ts",
  },
  {
    id: "blast",
    label: "Blast radius",
    title: "quanta blast --symbol OrderQueue.enqueue",
    code: "$ quanta blast --symbol OrderQueue.enqueue",
    result:
      "▸ direct callers:     7\n▸ transitive callers: 62\n▸ services touched:   checkout, fulfillment, reporting\n▸ estimated impact:   ~18% of production traffic\n▸ tests covering:     11 files (4 failing on staging)",
  },
  {
    id: "taint",
    label: "Taint trace",
    title: "quanta taint --source req.body.email --sink mailer.send",
    code: "$ quanta taint --source req.body.email --sink mailer.send",
    result:
      "✖ TAINT REACHES SINK\n  req.body.email\n    → routes/signup.ts:14 signupHandler\n    → services/user.ts:41 createUser\n    → services/mailer.ts:12 mailer.send\n  missing: validateEmail()  | sanitizeHeader()",
  },
  {
    id: "explain",
    label: "Explain",
    title: "quanta explain incident INC-2041",
    code: "$ quanta explain incident INC-2041",
    result:
      "INC-2041  checkout p95 latency spike (17:42 UTC, 38 min)\n─ cause   releases/web@v1024.2 shipped applyDiscount() change\n─ entry   src/payments/charge.ts → retry loop on lock contention\n─ fix     revert v1024.2 or add jitter to retry backoff\n─ prior   similar: INC-1894 (Mar 2026), INC-1552 (Nov 2025)",
  },
];

function InteractiveDemo(): JSX.Element {
  const [tab, setTab] = useState<DemoTab>("risk");
  const active = DEMOS.find((d) => d.id === tab) ?? DEMOS[0]!;
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "var(--fs-10)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: "var(--fw-bold)",
              color: "var(--fg-subtle)",
            }}
          >
            Try it yourself
          </div>
          <h3
            style={{
              margin: "var(--space-1) 0 0 0",
              fontSize: "var(--fs-lg)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "-0.01em",
            }}
          >
            Four commands. One workspace.
          </h3>
        </div>
        <div className="demo-billing-toggle" style={{ marginBottom: 0, marginLeft: "auto" }}>
          {DEMOS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={tab === d.id ? "is-active" : ""}
              onClick={() => setTab(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <DarkPanel padding="0" borderRadius="0">
        <DarkPanelHeader right={<span style={{ color: "#8a8a8a" }}>zsh · quanta v1.4</span>}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#ef4444",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#f59e0b",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#10b981",
              display: "inline-block",
            }}
          />
          <span style={{ marginLeft: "var(--space-2h)", color: "#c4c4c4" }}>{active.title}</span>
        </DarkPanelHeader>
        <DarkPanelBody padding="var(--space-4) var(--space-5)">
          <pre
            style={{
              margin: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              color: "#e4e4e4",
            }}
          >
            <span style={{ color: "#8a8a8a" }}>{active.code}</span>
            {"\n"}
            {active.result}
          </pre>
        </DarkPanelBody>
      </DarkPanel>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Small testimonials rail.
   ───────────────────────────────────────────────────────────────────── */
interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
  tint: string;
}

const SMALL_TESTIMONIALS: readonly Testimonial[] = [
  {
    quote: "The canvas replaced three internal dashboards. I finally know what a change touches.",
    name: "Mira O'Hara",
    role: "Staff Eng · Nordlight",
    initials: "MO",
    tint: "#dbeafe",
  },
  {
    quote: "Policies live in the repo. Review is two minutes, not two days.",
    name: "Theo Park",
    role: "Platform Lead · Prism Labs",
    initials: "TP",
    tint: "#fce7f3",
  },
  {
    quote: "Our SOC2 prep went from six weeks to one afternoon.",
    name: "Rhea Singh",
    role: "Head of Security · Verdant",
    initials: "RS",
    tint: "#dcfce7",
  },
  {
    quote: "Quanta caught a taint bug before it shipped. That alone paid for the year.",
    name: "Jonas Weir",
    role: "Security Eng · Helio",
    initials: "JW",
    tint: "#ffedd5",
  },
];

function SmallTestimonial({ t }: { t: Testimonial }): JSX.Element {
  return (
    <div
      style={{
        flex: "0 0 320px",
        padding: "var(--space-4)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2h)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "var(--fs-sm)",
          lineHeight: "var(--lh-relaxed)",
          color: "var(--fg)",
        }}
      >
        &ldquo;{t.quote}&rdquo;
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2h)",
          marginTop: "auto",
        }}
      >
        <span
          className="demo-avatar"
          style={{ background: t.tint, color: "var(--fg)" }}
        >
          {t.initials}
        </span>
        <div>
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)" }}>
            {t.name}
          </div>
          <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>{t.role}</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Pricing preview (compact — 3 plans).
   ───────────────────────────────────────────────────────────────────── */
interface PlanPreview {
  id: string;
  name: string;
  price: string;
  unit: string;
  blurb: string;
  bullets: readonly string[];
  cta: string;
  popular?: boolean;
  ctaTarget: string;
}

const PLAN_PREVIEWS: readonly PlanPreview[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    unit: "forever",
    blurb: "For solo devs and OSS maintainers.",
    bullets: ["1 workspace", "Basic intelligence", "Community support"],
    cta: "Start free",
    ctaTarget: "auth.signup",
  },
  {
    id: "team",
    name: "Team",
    price: "$15",
    unit: "seat / month",
    blurb: "For teams that ship weekly.",
    bullets: ["Unlimited workspaces", "All engines + policies", "SSO (Google + MS)"],
    cta: "Start 14-day trial",
    popular: true,
    ctaTarget: "auth.signup",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    unit: "contact us",
    blurb: "For orgs with compliance needs.",
    bullets: ["SAML + SCIM", "On-prem / VPC", "SOC 2 + DPA"],
    cta: "Talk to sales",
    ctaTarget: "legal.contact",
  },
];

/* ─────────────────────────────────────────────────────────────────────
   Logo pill — no real logos, just styled wordmarks.
   ───────────────────────────────────────────────────────────────────── */
const TRUSTED_BY: readonly string[] = [
  "Acme",
  "Nordlight",
  "Prism Labs",
  "Verdant",
  "Helio",
  "Mercator",
];

function LogoPill({ name }: { name: string }): JSX.Element {
  return (
    <span
      style={{
        padding: "var(--space-1h) var(--space-3h)",
        background: "var(--bg-muted)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-pill)",
        fontSize: "var(--fs-xs)",
        fontWeight: "var(--fw-semibold)",
        letterSpacing: "0.04em",
        color: "var(--fg-muted)",
      }}
    >
      {name}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Footer columns.
   ───────────────────────────────────────────────────────────────────── */
interface FooterCol {
  title: string;
  links: readonly { label: string; target?: string }[];
}

const FOOTER_COLS: readonly FooterCol[] = [
  {
    title: "Product",
    links: [
      { label: "Code Universe" },
      { label: "Intelligence engines" },
      { label: "Policies" },
      { label: "Agent" },
      { label: "Pricing", target: "billing.pricing" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs" },
      { label: "CLI", target: "developers.cli" },
      { label: "SDK", target: "developers.sdk" },
      { label: "API reference", target: "developers.api" },
      { label: "OpenAPI spec", target: "developers.openapi" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About" },
      { label: "Careers" },
      { label: "Changelog", target: "updates.changelog" },
      { label: "Roadmap", target: "updates.roadmap" },
      { label: "Contact sales", target: "legal.contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", target: "legal.terms" },
      { label: "Privacy", target: "legal.privacy" },
      { label: "Security", target: "security.disclosure" },
      { label: "Status", target: "legal.status" },
      { label: "DPA" },
    ],
  },
];

/* ═════════════════════════════════════════════════════════════════════
   PAGE
   ═════════════════════════════════════════════════════════════════════ */
export function LandingPage(): JSX.Element {
  const { navigate } = useDemoNav();
  const [lang, setLang] = useState("English");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  const navLinks: readonly string[] = [
    "Product",
    "Developers",
    "Pricing",
    "Docs",
    "Changelog",
    "About",
  ];

  return (
    <div style={{ width: "100%", margin: "calc(-1 * var(--space-6)) 0 0 0" }}>
      {/* ─── 1. NAV ─── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          padding: "var(--space-2h) var(--space-5)",
          background: "color-mix(in srgb, var(--bg) 92%, transparent)",
          backdropFilter: "saturate(180%) blur(10px)",
          borderBottom: "1px solid var(--border)",
          marginBottom: "var(--space-6)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontWeight: "var(--fw-bold)",
            letterSpacing: "-0.01em",
          }}
        >
          <QGlyph />
          <span style={{ fontSize: "var(--fs-md)" }}>Quanta</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            marginLeft: "var(--space-5)",
            fontSize: "var(--fs-xs)",
            color: "var(--fg-muted)",
          }}
        >
          {navLinks.map((l) => (
            <span key={l} style={{ cursor: "pointer" }}>
              {l}
            </span>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "inline-flex", gap: "var(--space-2)" }}>
          <button
            type="button"
            className="demo-btn demo-btn--ghost"
            onClick={() => navigate("auth.login")}
          >
            Log in
          </button>
          <button
            type="button"
            className="demo-btn demo-btn--primary"
            onClick={() => navigate("auth.signup")}
          >
            Start free <ArrowRight size={12} strokeWidth={2} />
          </button>
        </div>
      </nav>

      {/* ─── 2. HERO ─── */}
      <Section style={{ marginBottom: "var(--space-8)" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "var(--space-4)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1h)",
              padding: "2px var(--space-2h)",
              background: "var(--bg-accent-subtle)",
              border: "1px solid var(--border-accent-subtle)",
              color: "var(--accent)",
              borderRadius: "var(--radius-pill)",
              fontSize: "var(--fs-10)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <Sparkles size={11} strokeWidth={2} />
            New · v2026.04 · Code Universe
          </span>
          <h1
            className="demo-editorial-title"
            style={{
              margin: 0,
              fontSize: "clamp(44px, 6vw, 72px)",
              lineHeight: 1.02,
              maxWidth: 900,
            }}
          >
            Ship code your team actually <em>understands.</em>
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: "48ch",
              color: "var(--fg-muted)",
              fontFamily: "var(--font-display)",
              fontSize: 16,
              lineHeight: 1.55,
              letterSpacing: "-0.005em",
            }}
          >
            Quanta maps every function, every edge, every risk in your codebase. Your team writes
            policies once and ships them forever.
          </p>
          <div
            style={{
              display: "inline-flex",
              gap: "var(--space-2h)",
              marginTop: "var(--space-1)",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              className="demo-btn demo-btn--primary"
              onClick={() => navigate("auth.signup")}
              style={{
                height: 40,
                padding: "0 var(--space-4h)",
                borderRadius: "var(--radius-pill)",
                fontSize: "var(--fs-sm)",
                fontWeight: "var(--fw-semibold)",
              }}
            >
              Start free — no card required <ArrowRight size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              style={{
                height: 40,
                padding: "0 var(--space-4h)",
                borderRadius: "var(--radius-pill)",
                fontSize: "var(--fs-sm)",
                fontWeight: "var(--fw-semibold)",
              }}
            >
              <Play size={13} strokeWidth={2} /> Watch the 2-minute tour
            </button>
          </div>
          <div
            style={{
              marginTop: "var(--space-3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-2h)",
            }}
          >
            <span
              style={{
                fontSize: "var(--fs-10)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--fg-subtle)",
                fontWeight: "var(--fw-semibold)",
              }}
            >
              Trusted by 1,200+ engineering teams
            </span>
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {TRUSTED_BY.map((n) => (
                <LogoPill key={n} name={n} />
              ))}
            </div>
          </div>
        </div>

        {/* BIG canvas visual */}
        <div style={{ marginTop: "var(--space-6)" }}>
          <HeroCanvas />
        </div>
      </Section>

      {/* ─── 3. FEATURE STRIP ─── */}
      <Section style={{ marginBottom: "var(--space-8)" }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: "var(--space-5)",
          }}
        >
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
            One platform
          </div>
          <h2
            className="demo-editorial-title"
            style={{ margin: 0, fontSize: "clamp(28px, 3.2vw, 38px)" }}
          >
            Everything you need to ship <em>confident</em> code.
          </h2>
        </div>
        <div className="demo-grid-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} tile={f} />
          ))}
        </div>
      </Section>

      {/* ─── 4. HOW IT WORKS ─── */}
      <Section style={{ marginBottom: "var(--space-8)" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--space-5)" }}>
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
            How it works
          </div>
          <h2
            className="demo-editorial-title"
            style={{ margin: 0, fontSize: "clamp(28px, 3.2vw, 38px)" }}
          >
            From clone to policy in <em>three</em> steps.
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "var(--space-5)",
          }}
        >
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                padding: "var(--space-5)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg)",
              }}
            >
              <StepCircle n={i + 1} size={32} state="current" />
              <div
                style={{
                  fontSize: 18,
                  fontWeight: "var(--fw-bold)",
                  letterSpacing: "-0.01em",
                  marginTop: "var(--space-1)",
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  fontSize: "var(--fs-sm)",
                  color: "var(--fg-muted)",
                  lineHeight: "var(--lh-relaxed)",
                }}
              >
                {s.desc}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── 5. INTERACTIVE DEMO ─── */}
      <Section style={{ marginBottom: "var(--space-8)" }}>
        <InteractiveDemo />
      </Section>

      {/* ─── 6. BIG TESTIMONIAL + RAIL ─── */}
      <Section style={{ marginBottom: "var(--space-8)" }}>
        <div
          style={{
            padding: "var(--space-7) var(--space-6)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            background:
              "radial-gradient(1200px 400px at 50% 0%, var(--bg-accent-subtle) 0%, var(--bg) 60%)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <Quote size={36} strokeWidth={1.2} style={{ color: "var(--accent)" }} />
          <blockquote
            style={{
              margin: 0,
              maxWidth: 720,
              fontSize: 24,
              lineHeight: 1.35,
              letterSpacing: "-0.01em",
              fontWeight: "var(--fw-medium)",
            }}
          >
            &ldquo;We replaced three internal dashboards and a policy review board with Quanta. Our
            time-to-ship dropped 40% while our incident rate fell in half.&rdquo;
          </blockquote>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2h)",
              marginTop: "var(--space-2)",
            }}
          >
            <span
              className="demo-avatar"
              style={{ background: "#ede9fe", color: "#6d28d9", width: 40, height: 40 }}
            >
              JH
            </span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)" }}>
                June Huh
              </div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>
                VP Engineering · Mercator
              </div>
            </div>
          </div>
        </div>

        {/* Small rail */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-3)",
            overflowX: "auto",
            paddingTop: "var(--space-5)",
            paddingBottom: "var(--space-2)",
          }}
        >
          {SMALL_TESTIMONIALS.map((t) => (
            <SmallTestimonial key={t.name} t={t} />
          ))}
        </div>
      </Section>

      {/* ─── 7. PRICING PREVIEW ─── */}
      <Section style={{ marginBottom: "var(--space-8)" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
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
            Pricing
          </div>
          <h2
            className="demo-editorial-title"
            style={{ margin: 0, fontSize: "clamp(28px, 3.2vw, 38px)" }}
          >
            Start free. Grow when <em>you&apos;re</em> ready.
          </h2>
          <div
            className="demo-billing-toggle"
            style={{ marginTop: "var(--space-3)", marginBottom: 0 }}
          >
            <button
              type="button"
              className={billingCycle === "monthly" ? "is-active" : ""}
              onClick={() => setBillingCycle("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={billingCycle === "yearly" ? "is-active" : ""}
              onClick={() => setBillingCycle("yearly")}
            >
              Yearly{" "}
              <span className="demo-badge demo-badge--success" style={{ marginLeft: 6 }}>
                -20%
              </span>
            </button>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "var(--space-4)",
            maxWidth: 920,
            margin: "0 auto",
          }}
        >
          {PLAN_PREVIEWS.map((p) => (
            <div
              key={p.id}
              className={"demo-plan" + (p.popular ? " demo-plan--popular" : "")}
            >
              {p.popular ? <span className="demo-plan__tag">Most popular</span> : null}
              <div className="demo-plan__name">{p.name}</div>
              <div className="demo-plan__price">
                <span className="demo-plan__price-num">{p.price}</span>
                <span className="demo-plan__price-unit">/ {p.unit}</span>
              </div>
              <div className="demo-plan__desc">{p.blurb}</div>
              <ul className="demo-plan__features">
                {p.bullets.map((b) => (
                  <li key={b}>
                    <Check size={13} strokeWidth={2} /> {b}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={
                  p.popular ? "demo-btn demo-btn--primary" : "demo-btn demo-btn--ghost"
                }
                onClick={() => navigate(p.ctaTarget)}
                style={{ marginTop: "auto" }}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: "var(--space-4)" }}>
          <button
            type="button"
            className="demo-link"
            onClick={() => navigate("billing.pricing")}
          >
            See full comparison <ChevronRight size={12} strokeWidth={2} />
          </button>
        </div>
      </Section>

      {/* ─── 8. FINAL CTA ─── */}
      <Section style={{ marginBottom: "var(--space-8)" }}>
        <div
          style={{
            padding: "var(--space-7) var(--space-6)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            background:
              "linear-gradient(180deg, var(--bg-subtle) 0%, var(--bg) 100%)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <Zap size={28} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
          <h2
            className="demo-editorial-title"
            style={{
              margin: 0,
              fontSize: "clamp(32px, 4vw, 44px)",
              maxWidth: 640,
            }}
          >
            Your codebase deserves <em>better</em> eyes.
          </h2>
          <p
            style={{
              margin: 0,
              color: "var(--fg-muted)",
              fontSize: "var(--fs-md)",
              maxWidth: 520,
            }}
          >
            Start free. Bring your team when you&apos;re ready.
          </p>
          <div
            style={{
              display: "inline-flex",
              gap: "var(--space-2h)",
              marginTop: "var(--space-2)",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              className="demo-btn demo-btn--primary"
              onClick={() => navigate("auth.signup")}
              style={{
                height: 40,
                padding: "0 var(--space-4h)",
                borderRadius: "var(--radius-pill)",
                fontSize: "var(--fs-sm)",
                fontWeight: "var(--fw-semibold)",
              }}
            >
              Create your workspace <ArrowRight size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              onClick={() => navigate("legal.contact")}
              style={{
                height: 40,
                padding: "0 var(--space-4h)",
                borderRadius: "var(--radius-pill)",
                fontSize: "var(--fs-sm)",
                fontWeight: "var(--fw-semibold)",
              }}
            >
              Talk to sales
            </button>
          </div>
        </div>
      </Section>

      {/* ─── 9. FOOTER ─── */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          background: "var(--bg-subtle)",
          padding: "var(--space-6) 0 var(--space-4)",
          width: "100%",
        }}
      >
        <Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr repeat(4, 1fr)",
              gap: "var(--space-5)",
              marginBottom: "var(--space-5)",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  marginBottom: "var(--space-2h)",
                }}
              >
                <QGlyph />
                <span style={{ fontWeight: "var(--fw-bold)" }}>Quanta</span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--fs-xs)",
                  color: "var(--fg-muted)",
                  maxWidth: 260,
                  lineHeight: "var(--lh-relaxed)",
                }}
              >
                The software intelligence platform. Map, understand, and ship your codebase with
                confidence.
              </p>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <div
                  style={{
                    fontSize: "var(--fs-10)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontWeight: "var(--fw-bold)",
                    color: "var(--fg-subtle)",
                    marginBottom: "var(--space-2h)",
                  }}
                >
                  {col.title}
                </div>
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
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <button
                        type="button"
                        onClick={() => (l.target ? navigate(l.target) : undefined)}
                        style={{
                          background: "transparent",
                          border: 0,
                          padding: 0,
                          color: "var(--fg-muted)",
                          fontSize: "var(--fs-xs)",
                          cursor: l.target ? "pointer" : "default",
                          font: "inherit",
                          textAlign: "left",
                        }}
                      >
                        {l.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "var(--space-3)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>
              © 2026 Quanta, Inc. All rights reserved.
            </div>
            <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1h)",
                  fontSize: "var(--fs-10)",
                  color: "var(--fg-subtle)",
                }}
              >
                <Globe size={12} strokeWidth={1.8} />
                <select
                  className="demo-select"
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  style={{ height: 24, fontSize: "var(--fs-10)", padding: "0 var(--space-2)" }}
                >
                  <option>English</option>
                  <option>한국어</option>
                  <option>Deutsch</option>
                  <option>日本語</option>
                </select>
              </span>
              <div
                style={{
                  display: "inline-flex",
                  gap: "var(--space-2)",
                  alignItems: "center",
                  color: "var(--fg-muted)",
                }}
              >
                <SocialIcon Icon={AtSign} label="Twitter" />
                <SocialIcon Icon={Share2} label="LinkedIn" />
                <SocialIcon Icon={Mail} label="Email" />
                <SocialIcon Icon={BookOpen} label="Blog" />
                <SocialIcon Icon={Code2} label="Open source" />
              </div>
            </div>
          </div>
        </Section>
      </footer>
    </div>
  );
}

function SocialIcon({
  Icon,
  label,
}: {
  Icon: typeof AtSign;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      style={{
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: "50%",
        width: 26,
        height: 26,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "var(--fg-muted)",
      }}
    >
      <Icon size={12} strokeWidth={1.8} />
    </button>
  );
}
