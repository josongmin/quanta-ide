import { useMemo, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import {
  BookOpen,
  Calendar,
  Code2,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Gem,
  Map,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Package,
  Rocket,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { useDemoNav } from "../../DemoPage";

/* ─────────────────────────────────────────────────────────────────────
   Tiny deterministic PRNG (seeded LCG) so the heatmap stays stable.
   ───────────────────────────────────────────────────────────────────── */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/* ─────────────────────────────────────────────────────────────────────
   Types.
   ───────────────────────────────────────────────────────────────────── */
type ProfileTab = "overview" | "workspaces" | "contributions" | "policies" | "starred";

interface PinnedItem {
  name: string;
  desc: string;
  langs: readonly { label: string; color: string }[];
  stars: string;
  forks: string;
  updated: string;
}

interface ActivityItem {
  Icon: typeof GitCommit;
  tone: "accent" | "success" | "warn" | "neutral";
  primary: ReactNode;
  secondary: string;
  when: string;
}

interface AchievementItem {
  Icon: typeof Trophy;
  label: string;
  tint: string;
  fg: string;
}

/* ─────────────────────────────────────────────────────────────────────
   Data.
   ───────────────────────────────────────────────────────────────────── */
const PINNED: readonly PinnedItem[] = [
  {
    name: "quanta-analyzer-ts",
    desc: "TypeScript analyzer for Quanta. AST walking + risk scoring for 1M+ LOC monorepos.",
    langs: [
      { label: "TypeScript", color: "#3178c6" },
      { label: "Rust", color: "#dea584" },
    ],
    stars: "1.8k",
    forks: "142",
    updated: "updated 2 hours ago",
  },
  {
    name: "policy-kit",
    desc: "A curated pack of 40+ production-ready Quanta policies. Drop-in for any monorepo.",
    langs: [
      { label: "YAML", color: "#cb171e" },
      { label: "TypeScript", color: "#3178c6" },
    ],
    stars: "642",
    forks: "58",
    updated: "updated yesterday",
  },
  {
    name: "ada-sandbox",
    desc: "Personal playground for Quanta engine experiments. Expect rough edges.",
    langs: [{ label: "Python", color: "#3572a5" }],
    stars: "88",
    forks: "4",
    updated: "updated 1 week ago",
  },
];

const ACTIVITIES: readonly ActivityItem[] = [
  {
    Icon: GitCommit,
    tone: "neutral",
    primary: (
      <>
        Pushed 3 commits to <strong>acme/order-service</strong>
      </>
    ),
    secondary: "refactor(retry): add jitter to exponential backoff",
    when: "2 hours ago",
  },
  {
    Icon: ShieldCheck,
    tone: "success",
    primary: (
      <>
        Authored policy <code>no-secrets-in-commits</code>
      </>
    ),
    secondary: "Blocks high-entropy strings in committed source.",
    when: "1 day ago",
  },
  {
    Icon: GitPullRequest,
    tone: "accent",
    primary: (
      <>
        Reviewed PR <strong>#482</strong> in <strong>acme/payments</strong>
      </>
    ),
    secondary: "Flagged 2 blast-radius issues; approved after revisions.",
    when: "3 days ago",
  },
  {
    Icon: Sparkles,
    tone: "accent",
    primary: (
      <>
        Created workspace <strong>ada&apos;s sandbox</strong>
      </>
    ),
    secondary: "Initial import from github.com/ada/sandbox (88 files).",
    when: "1 week ago",
  },
  {
    Icon: Rocket,
    tone: "success",
    primary: (
      <>
        Released <code>quanta-analyzer-ts v1.2.0</code>
      </>
    ),
    secondary: "Adds async-taint tracking and 3× faster type resolution.",
    when: "2 weeks ago",
  },
  {
    Icon: Star,
    tone: "warn",
    primary: (
      <>
        Starred <strong>nordlight/rust-engine</strong>
      </>
    ),
    secondary: "A pluggable risk-scoring engine written in Rust.",
    when: "3 weeks ago",
  },
];

const ACHIEVEMENTS: readonly AchievementItem[] = [
  { Icon: Trophy, label: "100 PRs", tint: "#fef3c7", fg: "#b45309" },
  { Icon: ScrollText, label: "Policy author", tint: "#dbeafe", fg: "#1d4ed8" },
  { Icon: Zap, label: "Speed demon", tint: "#fee2e2", fg: "#b91c1c" },
  { Icon: Sparkles, label: "Agent power user", tint: "#ede9fe", fg: "#6d28d9" },
  { Icon: ShieldCheck, label: "Security sleuth", tint: "#dcfce7", fg: "#15803d" },
  { Icon: Gem, label: "Early adopter", tint: "#fce7f3", fg: "#be185d" },
];

const STATS: readonly { label: string; value: string; Icon: typeof Users }[] = [
  { label: "Followers", value: "1.2k", Icon: Users },
  { label: "Following", value: "142", Icon: UserPlus },
  { label: "Public workspaces", value: "8", Icon: Map },
  { label: "Policies authored", value: "34", Icon: ShieldCheck },
  { label: "Reviews", value: "892", Icon: GitPullRequest },
];

/* ─────────────────────────────────────────────────────────────────────
   Build 52×7 heatmap cells with seeded randomness.
   ───────────────────────────────────────────────────────────────────── */
interface HeatmapCell {
  level: 0 | 1 | 2 | 3 | 4;
}

function buildHeatmap(): HeatmapCell[][] {
  const rand = lcg(2026);
  const weeks: HeatmapCell[][] = [];
  for (let w = 0; w < 52; w++) {
    const col: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const p = rand();
      // Bias so most cells are low/zero, with occasional streaks.
      let level: HeatmapCell["level"];
      if (p < 0.42) level = 0;
      else if (p < 0.66) level = 1;
      else if (p < 0.84) level = 2;
      else if (p < 0.95) level = 3;
      else level = 4;
      col.push({ level });
    }
    weeks.push(col);
  }
  return weeks;
}

const HEATMAP_COLORS: Record<HeatmapCell["level"], string> = {
  0: "var(--bg-muted)",
  1: "color-mix(in srgb, var(--accent) 25%, var(--bg-muted))",
  2: "color-mix(in srgb, var(--accent) 45%, var(--bg))",
  3: "color-mix(in srgb, var(--accent) 70%, var(--bg))",
  4: "var(--accent)",
};

const MONTH_LABELS: readonly string[] = [
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
];

/* ─────────────────────────────────────────────────────────────────────
   Helpers.
   ───────────────────────────────────────────────────────────────────── */
function toneColor(tone: ActivityItem["tone"]): { bg: string; fg: string } {
  switch (tone) {
    case "accent":
      return { bg: "var(--bg-accent-subtle)", fg: "var(--accent)" };
    case "success":
      return { bg: "var(--bg-success-subtle)", fg: "var(--success)" };
    case "warn":
      return { bg: "var(--bg-warn-subtle)", fg: "var(--warn)" };
    default:
      return { bg: "var(--bg-muted)", fg: "var(--fg-muted)" };
  }
}

function SectionTitle({
  kicker,
  title,
  right,
}: {
  kicker?: string;
  title: string;
  right?: ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "var(--space-3)",
        marginBottom: "var(--space-3)",
      }}
    >
      <div>
        {kicker ? (
          <div
            style={{
              fontSize: "var(--fs-10)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: "var(--fw-bold)",
              color: "var(--fg-subtle)",
              marginBottom: 2,
            }}
          >
            {kicker}
          </div>
        ) : null}
        <h2
          style={{
            margin: 0,
            fontSize: "var(--fs-lg)",
            fontWeight: "var(--fw-bold)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
      </div>
      {right ? <div style={{ marginLeft: "auto" }}>{right}</div> : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Pinned card with hover state.
   ───────────────────────────────────────────────────────────────────── */
function PinnedCard({ item }: { item: PinnedItem }): JSX.Element {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "var(--space-4)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: hover ? "var(--bg-subtle)" : "var(--bg)",
        transition: "background 0.14s ease, border-color 0.14s ease, transform 0.14s ease",
        borderColor: hover ? "var(--border-strong)" : "var(--border)",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-1h)",
        }}
      >
        <BookOpen size={12} strokeWidth={1.8} style={{ color: "var(--fg-subtle)" }} />
        <span
          style={{
            fontSize: "var(--fs-sm)",
            fontWeight: "var(--fw-semibold)",
            color: "var(--accent)",
          }}
        >
          {item.name}
        </span>
        <span
          className="demo-badge"
          style={{ marginLeft: "auto", fontSize: "var(--fs-10)" }}
        >
          public
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "var(--fs-xs)",
          color: "var(--fg-muted)",
          lineHeight: "var(--lh-relaxed)",
          minHeight: 44,
        }}
      >
        {item.desc}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          marginTop: "var(--space-1)",
          fontSize: "var(--fs-10)",
          color: "var(--fg-subtle)",
        }}
      >
        {item.langs.map((l) => (
          <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: l.color,
              }}
            />
            {l.label}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Star size={10} strokeWidth={2} /> {item.stars}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <GitBranch size={10} strokeWidth={2} /> {item.forks}
        </span>
        <span style={{ marginLeft: "auto" }}>{item.updated}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Heatmap block.
   ───────────────────────────────────────────────────────────────────── */
function Heatmap(): JSX.Element {
  const weeks = useMemo(() => buildHeatmap(), []);
  const CELL = 11;
  const GAP = 3;
  const cols = weeks.length;
  const rows = 7;
  const width = cols * (CELL + GAP);
  const height = rows * (CELL + GAP) + 16;

  return (
    <div
      style={{
        padding: "var(--space-4)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginBottom: "var(--space-3)",
        }}
      >
        <div
          style={{
            fontSize: "var(--fs-sm)",
            fontWeight: "var(--fw-semibold)",
            color: "var(--fg)",
          }}
        >
          1,248 contributions in the last year
        </div>
        <span
          className="demo-badge demo-badge--success"
          style={{ fontSize: "var(--fs-10)" }}
        >
          +14% YoY
        </span>
        <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>Less</span>
          {([0, 1, 2, 3, 4] as const).map((lv) => (
            <span
              key={lv}
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: HEATMAP_COLORS[lv],
                border: "1px solid color-mix(in srgb, var(--fg) 5%, transparent)",
              }}
            />
          ))}
          <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>More</span>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden
          style={{ display: "block" }}
        >
          {/* Month labels at top */}
          {MONTH_LABELS.map((m, i) => (
            <text
              key={m + i}
              x={i * ((CELL + GAP) * 52) / MONTH_LABELS.length}
              y={10}
              fontSize={9}
              fill="var(--fg-subtle)"
              fontFamily="var(--font-mono)"
            >
              {m}
            </text>
          ))}
          {/* Cells */}
          {weeks.map((col, w) =>
            col.map((cell, d) => (
              <rect
                key={`${w}-${d}`}
                x={w * (CELL + GAP)}
                y={16 + d * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={2}
                ry={2}
                fill={HEATMAP_COLORS[cell.level]}
              />
            )),
          )}
        </svg>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Activity row.
   ───────────────────────────────────────────────────────────────────── */
function ActivityRow({ item }: { item: ActivityItem }): JSX.Element {
  const { bg, fg } = toneColor(item.tone);
  const Icon = item.Icon;
  return (
    <div
      className="demo-row"
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr auto",
        gap: "var(--space-3)",
        alignItems: "center",
        padding: "var(--space-3) var(--space-4)",
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: bg,
          color: fg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={13} strokeWidth={2} />
      </span>
      <div className="demo-row__primary">
        <div
          style={{
            fontSize: "var(--fs-sm)",
            fontWeight: "var(--fw-medium)",
            color: "var(--fg)",
          }}
        >
          {item.primary}
        </div>
        <div
          style={{
            fontSize: "var(--fs-xs)",
            color: "var(--fg-subtle)",
            marginTop: 2,
          }}
        >
          {item.secondary}
        </div>
      </div>
      <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", whiteSpace: "nowrap" }}>
        {item.when}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Achievement badge.
   ───────────────────────────────────────────────────────────────────── */
function AchievementBadge({ item }: { item: AchievementItem }): JSX.Element {
  const Icon = item.Icon;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-1h)",
        minWidth: 88,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: item.tint,
          color: item.fg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--border)",
        }}
      >
        <Icon size={26} strokeWidth={1.8} />
      </div>
      <div
        style={{
          fontSize: "var(--fs-10)",
          fontWeight: "var(--fw-semibold)",
          color: "var(--fg-muted)",
          textAlign: "center",
        }}
      >
        {item.label}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Banner gradient background — pure CSS.
   ───────────────────────────────────────────────────────────────────── */
const BANNER_STYLE: CSSProperties = {
  height: 160,
  width: "100%",
  borderRadius: "var(--radius-lg)",
  background:
    "radial-gradient(900px 200px at 18% 20%, color-mix(in srgb, var(--accent) 28%, transparent) 0%, transparent 60%), " +
    "radial-gradient(600px 220px at 82% 70%, color-mix(in srgb, var(--accent-purple) 28%, transparent) 0%, transparent 55%), " +
    "radial-gradient(500px 200px at 50% 50%, color-mix(in srgb, var(--success) 18%, transparent) 0%, transparent 55%), " +
    "linear-gradient(135deg, var(--bg-subtle) 0%, var(--bg) 100%)",
  border: "1px solid var(--border)",
};

/* ═════════════════════════════════════════════════════════════════════
   PAGE
   ═════════════════════════════════════════════════════════════════════ */
export function PublicProfilePage(): JSX.Element {
  const { navigate } = useDemoNav();
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [following, setFollowing] = useState(false);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1120,
        margin: "0 auto",
        padding: "0 var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
      }}
    >
      {/* ─── Banner ─── */}
      <div style={BANNER_STYLE} aria-hidden />

      {/* ─── Profile header (overlaps banner) ─── */}
      <div
        style={{
          marginTop: -70,
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: "var(--space-4)",
          alignItems: "flex-end",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "#ede9fe",
            color: "#6d28d9",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: "var(--fw-bold)",
            letterSpacing: "-0.02em",
            border: "4px solid var(--bg)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          AL
        </div>

        {/* Name block */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", paddingBottom: 6 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: "var(--fw-bold)",
                letterSpacing: "-0.02em",
              }}
            >
              Ada Lovelace
            </h1>
            <span
              style={{
                fontSize: "var(--fs-10)",
                color: "var(--fg-subtle)",
                border: "1px solid var(--border)",
                padding: "1px 8px",
                borderRadius: "var(--radius-pill)",
                fontWeight: "var(--fw-semibold)",
                letterSpacing: "0.04em",
              }}
            >
              she/her
            </span>
            <span
              className="demo-badge demo-badge--accent"
              style={{ fontSize: "var(--fs-10)" }}
            >
              <ShieldCheck size={10} strokeWidth={2} /> Verified
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--fs-sm)",
              color: "var(--fg-subtle)",
              fontFamily: "var(--font-mono)",
            }}
          >
            @ada
          </div>
          <p
            style={{
              margin: "var(--space-1) 0 0 0",
              fontSize: "var(--fs-sm)",
              color: "var(--fg)",
              lineHeight: "var(--lh-relaxed)",
              maxWidth: 560,
            }}
          >
            Compiler nerd, policy author, taint-analysis enthusiast. Currently shipping the
            TypeScript analyzer at Quanta. I write about type systems, static analysis, and why
            code reviews should be boring.
          </p>
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              marginTop: "var(--space-2)",
              fontSize: "var(--fs-xs)",
              color: "var(--fg-muted)",
              flexWrap: "wrap",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <MapPin size={11} strokeWidth={2} /> Seoul, KR
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Calendar size={11} strokeWidth={2} /> Joined March 2024
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "var(--accent)",
                cursor: "pointer",
              }}
              onClick={() => navigate("team.members")}
            >
              <Users size={11} strokeWidth={2} /> Quanta · Platform team
            </span>
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            display: "inline-flex",
            gap: "var(--space-2)",
            paddingBottom: 6,
          }}
        >
          <button
            type="button"
            className={following ? "demo-btn demo-btn--ghost" : "demo-btn demo-btn--primary"}
            onClick={() => setFollowing((f) => !f)}
          >
            {following ? (
              <>
                <ShieldCheck size={13} strokeWidth={2} /> Following
              </>
            ) : (
              <>
                <UserPlus size={13} strokeWidth={2} /> Follow
              </>
            )}
          </button>
          <button type="button" className="demo-btn demo-btn--ghost">
            <MessageSquare size={13} strokeWidth={2} /> Message
          </button>
          <button
            type="button"
            className="demo-btn demo-btn--ghost"
            aria-label="More actions"
            style={{ padding: "0 var(--space-2)" }}
          >
            <MoreHorizontal size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ─── Stats strip ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {STATS.map((s) => {
          const Icon = s.Icon;
          return (
            <div
              key={s.label}
              style={{
                padding: "var(--space-3) var(--space-4)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-muted)",
                  color: "var(--fg-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={14} strokeWidth={2} />
              </span>
              <div>
                <div
                  style={{
                    fontSize: "var(--fs-lg)",
                    fontWeight: "var(--fw-bold)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: "var(--fs-10)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--fg-subtle)",
                  }}
                >
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Tabs bar ─── */}
      <div className="demo-billing-toggle" style={{ alignSelf: "flex-start", marginBottom: 0 }}>
        <button
          type="button"
          className={tab === "overview" ? "is-active" : ""}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={tab === "workspaces" ? "is-active" : ""}
          onClick={() => setTab("workspaces")}
        >
          Workspaces <span style={{ color: "var(--fg-subtle)" }}>(8)</span>
        </button>
        <button
          type="button"
          className={tab === "contributions" ? "is-active" : ""}
          onClick={() => setTab("contributions")}
        >
          Contributions
        </button>
        <button
          type="button"
          className={tab === "policies" ? "is-active" : ""}
          onClick={() => setTab("policies")}
        >
          Policies <span style={{ color: "var(--fg-subtle)" }}>(34)</span>
        </button>
        <button
          type="button"
          className={tab === "starred" ? "is-active" : ""}
          onClick={() => setTab("starred")}
        >
          Starred
        </button>
      </div>

      {/* ─── Content ─── */}
      {tab === "overview" ? (
        <>
          {/* Pinned */}
          <div>
            <SectionTitle
              kicker="Pinned"
              title="Highlighted work"
              right={
                <button
                  type="button"
                  className="demo-link"
                  onClick={() => setTab("workspaces")}
                >
                  See all workspaces →
                </button>
              }
            />
            <div className="demo-grid-3">
              {PINNED.map((p) => (
                <PinnedCard key={p.name} item={p} />
              ))}
            </div>
          </div>

          {/* Heatmap */}
          <div>
            <SectionTitle kicker="Activity" title="Contribution graph" />
            <Heatmap />
          </div>

          {/* Activity list */}
          <div>
            <SectionTitle
              kicker="Recent"
              title="Public activity"
              right={
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>
                  Only public events are shown
                </span>
              }
            />
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg)",
                overflow: "hidden",
              }}
            >
              {ACTIVITIES.map((a, i) => (
                <ActivityRow key={i} item={a} />
              ))}
            </div>
          </div>

          {/* Achievements */}
          <div>
            <SectionTitle kicker="Achievements" title="Earned badges" />
            <div
              style={{
                display: "flex",
                gap: "var(--space-4)",
                overflowX: "auto",
                padding: "var(--space-3) var(--space-1h)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg)",
              }}
            >
              {ACHIEVEMENTS.map((a) => (
                <AchievementBadge key={a.label} item={a} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="demo-empty">
          {tab === "workspaces" ? (
            <Package size={24} strokeWidth={1.6} />
          ) : tab === "contributions" ? (
            <GitCommit size={24} strokeWidth={1.6} />
          ) : tab === "policies" ? (
            <ShieldCheck size={24} strokeWidth={1.6} />
          ) : (
            <Star size={24} strokeWidth={1.6} />
          )}
          <div className="demo-empty__title">
            {tab === "workspaces"
              ? "All public workspaces"
              : tab === "contributions"
                ? "Full contribution history"
                : tab === "policies"
                  ? "Authored policies"
                  : "Starred repositories"}
          </div>
          <p className="demo-empty__hint">
            {tab === "workspaces"
              ? "A full list of Ada's 8 public workspaces would live here, filterable by language and activity."
              : tab === "contributions"
                ? "The full commit / PR / review timeline across every public workspace would live here."
                : tab === "policies"
                  ? "The 34 policies Ada has authored would be listed here — searchable, copy-ready YAML."
                  : "Everything Ada has starred on Quanta would live here — workspaces, policies, and packs."}
          </p>
          <button
            type="button"
            className="demo-btn demo-btn--ghost"
            onClick={() => setTab("overview")}
            style={{ marginTop: "var(--space-3)" }}
          >
            Back to overview
          </button>
        </div>
      )}

      {/* ─── Footer ─── */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          marginTop: "var(--space-4)",
          paddingTop: "var(--space-3)",
          paddingBottom: "var(--space-4)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          fontSize: "var(--fs-10)",
          color: "var(--fg-subtle)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Code2 size={11} strokeWidth={1.8} /> quanta.dev/~ada
        </span>
        <div style={{ marginLeft: "auto", display: "inline-flex", gap: "var(--space-3)" }}>
          <button
            type="button"
            className="demo-link"
            onClick={() => navigate("legal.terms")}
            style={{ fontSize: "var(--fs-10)" }}
          >
            Terms
          </button>
          <button
            type="button"
            className="demo-link"
            onClick={() => navigate("legal.privacy")}
            style={{ fontSize: "var(--fs-10)" }}
          >
            Privacy
          </button>
          <button
            type="button"
            className="demo-link"
            onClick={() => navigate("legal.status")}
            style={{ fontSize: "var(--fs-10)" }}
          >
            Status
          </button>
          <button
            type="button"
            className="demo-link"
            onClick={() => navigate("legal.help")}
            style={{ fontSize: "var(--fs-10)" }}
          >
            Help
          </button>
        </div>
      </footer>
    </div>
  );
}

