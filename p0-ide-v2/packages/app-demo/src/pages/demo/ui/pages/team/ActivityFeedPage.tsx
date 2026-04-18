import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bot,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  GitCommit,
  GitPullRequest,
  KeyRound,
  MessageCircle,
  Rss,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { useDemoNav } from "../../DemoPage";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { StatCard } from "../../internal/StatCard";
import { Sparkline } from "../../internal/Sparkline";
import { initials, pickPalette } from "../../internal/avatar-utils";

type EventKind =
  | "code.pushed"
  | "policy.violated"
  | "policy.created"
  | "review.requested"
  | "review.approved"
  | "member.joined"
  | "member.role_changed"
  | "agent.run"
  | "incident.opened"
  | "incident.resolved"
  | "billing.payment_succeeded"
  | "key.rotated";

type EventGroup =
  | "Code"
  | "Policies"
  | "Reviews"
  | "Members"
  | "Agent"
  | "Billing"
  | "Incidents";

type Tone = "accent" | "warn" | "success" | "danger" | "neutral" | "purple";

interface EventItem {
  id: string;
  kind: EventKind;
  group: EventGroup;
  tone: Tone;
  actor: string;
  time: string;
  relative: string;
  day: "Today · Thursday Apr 19" | "Yesterday · Wednesday Apr 18" | "Tuesday Apr 17";
  body: ReactNode;
  target?: { label: string; navId: string };
  expandable?: ReactNode;
}

const TONE_BG: Record<Tone, string> = {
  accent: "var(--bg-accent-subtle)",
  warn: "var(--bg-warn-subtle)",
  success: "var(--bg-success-subtle)",
  danger: "var(--bg-danger-subtle)",
  neutral: "var(--bg-subtle)",
  purple: "var(--bg-subtle)",
};

const TONE_FG: Record<Tone, string> = {
  accent: "var(--accent)",
  warn: "var(--warn)",
  success: "var(--success)",
  danger: "var(--danger)",
  neutral: "var(--fg-muted)",
  purple: "#6d28d9",
};

const TONE_BORDER: Record<Tone, string> = {
  accent: "var(--border-accent-subtle)",
  warn: "var(--border-warn-subtle)",
  success: "var(--border-success-subtle)",
  danger: "var(--border-danger-subtle)",
  neutral: "var(--border)",
  purple: "var(--border)",
};

const ICON_FOR: Record<EventKind, typeof Activity> = {
  "code.pushed": GitCommit,
  "policy.violated": ShieldAlert,
  "policy.created": ShieldCheck,
  "review.requested": GitPullRequest,
  "review.approved": BadgeCheck,
  "member.joined": UserPlus,
  "member.role_changed": UserCheck,
  "agent.run": Bot,
  "incident.opened": AlertTriangle,
  "incident.resolved": ShieldCheck,
  "billing.payment_succeeded": CreditCard,
  "key.rotated": KeyRound,
};

const KIND_TO_GROUP: Record<EventKind, EventGroup> = {
  "code.pushed": "Code",
  "policy.violated": "Policies",
  "policy.created": "Policies",
  "review.requested": "Reviews",
  "review.approved": "Reviews",
  "member.joined": "Members",
  "member.role_changed": "Members",
  "agent.run": "Agent",
  "incident.opened": "Incidents",
  "incident.resolved": "Incidents",
  "billing.payment_succeeded": "Billing",
  "key.rotated": "Policies",
};

const FILTER_OPTIONS = [
  "All",
  "Code",
  "Policies",
  "Reviews",
  "Members",
  "Agent",
  "Billing",
  "Incidents",
] as const;
type FilterOption = (typeof FILTER_OPTIONS)[number];

function TargetChip({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 8px",
        height: 20,
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        background: "var(--bg-subtle)",
        color: "var(--fg)",
        fontSize: "var(--fs-10)",
        fontFamily: "var(--font-mono)",
        letterSpacing: 0,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {label}
    </button>
  );
}

function ActorAvatar({ name }: { name: string }) {
  const p = pickPalette(name);
  return (
    <span
      aria-label={name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: p.bg,
        color: p.fg,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0,
        flex: "0 0 auto",
      }}
    >
      {initials(name)}
    </span>
  );
}

export function ActivityFeedPage() {
  const nav = useDemoNav();
  const [activeFilter, setActiveFilter] = useState<FilterOption>("All");
  const [dateRange, setDateRange] = useState("7d");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>("today-1");

  const events = useMemo<EventItem[]>(() => {
    const today = "Today · Thursday Apr 19" as const;
    const yesterday = "Yesterday · Wednesday Apr 18" as const;
    const tuesday = "Tuesday Apr 17" as const;
    const raw: Array<Omit<EventItem, "group" | "day"> & {
      day: EventItem["day"];
    }> = [
      // ===== TODAY =====
      {
        id: "today-1",
        kind: "code.pushed",
        tone: "accent",
        actor: "Ada Lovelace",
        time: "14:28",
        relative: "14 min ago",
        day: today,
        body: (
          <>
            pushed <strong>3 commits</strong> to <TargetChip label="order-service/main" />
          </>
        ),
        target: { label: "order-service/main", navId: "team.members" },
        expandable: (
          <ul
            style={{
              margin: "var(--space-2) 0 0",
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {[
              { sha: "9a21f3b", msg: "Refactor taxes.py to use decimal.Decimal" },
              { sha: "b17cc04", msg: "Add idempotency key to POST /orders" },
              { sha: "4e8d2a1", msg: "Fix off-by-one in pagination offsets" },
            ].map((c) => (
              <li
                key={c.sha}
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px minmax(0, 1fr)",
                  gap: "var(--space-2)",
                  fontSize: "var(--fs-xs)",
                }}
              >
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--accent)",
                  }}
                >
                  {c.sha}
                </code>
                <span style={{ color: "var(--fg-muted)" }}>{c.msg}</span>
              </li>
            ))}
          </ul>
        ),
      },
      {
        id: "today-2",
        kind: "policy.violated",
        tone: "warn",
        actor: "Rich Hickey",
        time: "14:22",
        relative: "20 min ago",
        day: today,
        body: (
          <>
            policy <TargetChip label="secrets-in-commits" /> triggered on{" "}
            <TargetChip label="order-service" />
          </>
        ),
        target: { label: "admin.audit", navId: "admin.audit" },
      },
      {
        id: "today-3",
        kind: "review.requested",
        tone: "accent",
        actor: "Grace Hopper",
        time: "13:58",
        relative: "44 min ago",
        day: today,
        body: (
          <>
            requested your review on <TargetChip label="PR #482" /> —
            &nbsp;<span style={{ color: "var(--fg-muted)" }}>Add retries to webhook dispatcher</span>
          </>
        ),
      },
      {
        id: "today-4",
        kind: "agent.run",
        tone: "purple",
        actor: "Quanta Agent",
        time: "13:42",
        relative: "1h ago",
        day: today,
        body: (
          <>
            generated a <strong>refactor plan</strong> for <TargetChip label="taxes.py" /> — 4 steps, est. 22 min
          </>
        ),
        expandable: (
          <ol
            style={{
              margin: "var(--space-2) 0 0",
              paddingLeft: "var(--space-4)",
              color: "var(--fg-muted)",
              fontSize: "var(--fs-xs)",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <li>Extract rate table into <code style={{ fontFamily: "var(--font-mono)" }}>rates.py</code></li>
            <li>Replace floats with <code style={{ fontFamily: "var(--font-mono)" }}>Decimal</code></li>
            <li>Add golden-file tests for 12 brackets</li>
            <li>Wire to analysis engine for drift checks</li>
          </ol>
        ),
      },
      {
        id: "today-5",
        kind: "policy.created",
        tone: "success",
        actor: "Ada Lovelace",
        time: "12:30",
        relative: "2h ago",
        day: today,
        body: (
          <>
            authored policy <TargetChip label="no-direct-db-access" /> — now attached to 4 services
          </>
        ),
      },
      {
        id: "today-6",
        kind: "review.approved",
        tone: "success",
        actor: "Alan Turing",
        time: "12:02",
        relative: "2h 40m ago",
        day: today,
        body: (
          <>
            approved <TargetChip label="PR #480" /> — <span style={{ color: "var(--fg-muted)" }}>Migrate billing cycle to yearly</span>
          </>
        ),
      },
      {
        id: "today-7",
        kind: "incident.opened",
        tone: "danger",
        actor: "Alan Turing",
        time: "11:14",
        relative: "3h 28m ago",
        day: today,
        body: (
          <>
            opened incident <TargetChip label="INC-43" /> — <strong>elevated p95 latency on analysis engine</strong>
          </>
        ),
        target: { label: "legal.status", navId: "legal.status" },
      },
      {
        id: "today-8",
        kind: "incident.resolved",
        tone: "success",
        actor: "Mei Zhang",
        time: "11:46",
        relative: "4h ago",
        day: today,
        body: (
          <>
            resolved <TargetChip label="INC-43" /> — <span style={{ color: "var(--fg-muted)" }}>duration 32 min</span>
          </>
        ),
        target: { label: "legal.status", navId: "legal.status" },
      },
      {
        id: "today-9",
        kind: "member.joined",
        tone: "success",
        actor: "Margaret Hamilton",
        time: "10:01",
        relative: "4h 41m ago",
        day: today,
        body: <>joined the workspace as <strong>Engineer</strong></>,
        target: { label: "team.members", navId: "team.members" },
      },
      {
        id: "today-10",
        kind: "billing.payment_succeeded",
        tone: "success",
        actor: "Stripe",
        time: "09:00",
        relative: "5h 42m ago",
        day: today,
        body: (
          <>
            invoice <TargetChip label="INV-2026-0005" /> paid — <strong>$792.00</strong>
          </>
        ),
        target: { label: "billing.invoice", navId: "billing.invoice" },
      },
      // ===== YESTERDAY =====
      {
        id: "yest-1",
        kind: "code.pushed",
        tone: "accent",
        actor: "Linus Torvalds",
        time: "23:42",
        relative: "yesterday",
        day: yesterday,
        body: (
          <>
            pushed <strong>7 commits</strong> to <TargetChip label="analysis-engine/main" />
          </>
        ),
      },
      {
        id: "yest-2",
        kind: "key.rotated",
        tone: "warn",
        actor: "Alan Turing",
        time: "18:15",
        relative: "yesterday",
        day: yesterday,
        body: (
          <>
            rotated API key <TargetChip label="CI — prod" /> — old key revoked in 24h
          </>
        ),
        target: { label: "admin.keys", navId: "admin.keys" },
      },
      {
        id: "yest-3",
        kind: "policy.violated",
        tone: "warn",
        actor: "Donald Knuth",
        time: "16:44",
        relative: "yesterday",
        day: yesterday,
        body: (
          <>
            policy <TargetChip label="async-in-handler-check" /> triggered on{" "}
            <TargetChip label="checkout-service" />
          </>
        ),
      },
      {
        id: "yest-4",
        kind: "review.approved",
        tone: "success",
        actor: "Grace Hopper",
        time: "15:10",
        relative: "yesterday",
        day: yesterday,
        body: (
          <>
            approved <TargetChip label="PR #479" /> — <span style={{ color: "var(--fg-muted)" }}>Extract HTTP retry helper</span>
          </>
        ),
      },
      {
        id: "yest-5",
        kind: "member.role_changed",
        tone: "neutral",
        actor: "Ada Lovelace",
        time: "14:20",
        relative: "yesterday",
        day: yesterday,
        body: (
          <>
            changed <strong>Rich Hickey</strong>'s role from <TargetChip label="Engineer" /> to{" "}
            <TargetChip label="Reviewer" />
          </>
        ),
        target: { label: "team.members", navId: "team.members" },
      },
      {
        id: "yest-6",
        kind: "agent.run",
        tone: "purple",
        actor: "Quanta Agent",
        time: "11:58",
        relative: "yesterday",
        day: yesterday,
        body: (
          <>
            completed a <strong>dependency audit</strong> on <TargetChip label="web-app" /> — 3 vulnerable, 0 critical
          </>
        ),
      },
      {
        id: "yest-7",
        kind: "review.requested",
        tone: "accent",
        actor: "Rich Hickey",
        time: "10:21",
        relative: "yesterday",
        day: yesterday,
        body: (
          <>
            requested review from <strong>Ada Lovelace</strong> on <TargetChip label="PR #478" />
          </>
        ),
      },
      {
        id: "yest-8",
        kind: "code.pushed",
        tone: "accent",
        actor: "Ada Lovelace",
        time: "09:34",
        relative: "yesterday",
        day: yesterday,
        body: (
          <>
            pushed <strong>1 commit</strong> to <TargetChip label="order-service/feat/idempotency" />
          </>
        ),
      },
      {
        id: "yest-9",
        kind: "billing.payment_succeeded",
        tone: "success",
        actor: "Stripe",
        time: "09:00",
        relative: "yesterday",
        day: yesterday,
        body: (
          <>
            invoice <TargetChip label="INV-2026-0004" /> paid — <strong>$792.00</strong>
          </>
        ),
        target: { label: "billing.invoices", navId: "billing.invoices" },
      },
      // ===== TUESDAY =====
      {
        id: "tue-1",
        kind: "policy.created",
        tone: "success",
        actor: "Grace Hopper",
        time: "17:55",
        relative: "2d ago",
        day: tuesday,
        body: (
          <>
            authored policy <TargetChip label="pii-in-logs" /> — seeded from GDPR template
          </>
        ),
      },
      {
        id: "tue-2",
        kind: "member.joined",
        tone: "success",
        actor: "Katherine Johnson",
        time: "16:12",
        relative: "2d ago",
        day: tuesday,
        body: <>joined the workspace as <strong>Reviewer</strong></>,
        target: { label: "team.members", navId: "team.members" },
      },
      {
        id: "tue-3",
        kind: "incident.opened",
        tone: "danger",
        actor: "Alan Turing",
        time: "14:20",
        relative: "2d ago",
        day: tuesday,
        body: (
          <>
            opened incident <TargetChip label="INC-42" /> — <strong>elevated 5xx on api.quanta.dev</strong>
          </>
        ),
        target: { label: "legal.status", navId: "legal.status" },
      },
      {
        id: "tue-4",
        kind: "incident.resolved",
        tone: "success",
        actor: "Mei Zhang",
        time: "14:52",
        relative: "2d ago",
        day: tuesday,
        body: (
          <>
            resolved <TargetChip label="INC-42" /> — <span style={{ color: "var(--fg-muted)" }}>duration 32 min</span>
          </>
        ),
      },
      {
        id: "tue-5",
        kind: "agent.run",
        tone: "purple",
        actor: "Quanta Agent",
        time: "12:45",
        relative: "2d ago",
        day: tuesday,
        body: (
          <>
            proposed <strong>3 test cases</strong> for <TargetChip label="billing/discount.ts" />
          </>
        ),
      },
      {
        id: "tue-6",
        kind: "key.rotated",
        tone: "warn",
        actor: "Ada Lovelace",
        time: "10:12",
        relative: "2d ago",
        day: tuesday,
        body: (
          <>
            rotated API key <TargetChip label="deploy — prod" />
          </>
        ),
        target: { label: "admin.keys", navId: "admin.keys" },
      },
    ];
    return raw.map((e) => ({ ...e, group: KIND_TO_GROUP[e.kind] }));
  }, []);

  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (activeFilter !== "All" && e.group !== activeFilter) return false;
      if (!q) return true;
      return e.actor.toLowerCase().includes(q);
    });
  }, [events, activeFilter, search]);

  const grouped = useMemo(() => {
    const byDay = new Map<EventItem["day"], EventItem[]>();
    for (const e of visibleEvents) {
      const list = byDay.get(e.day) ?? [];
      list.push(e);
      byDay.set(e.day, list);
    }
    return Array.from(byDay.entries());
  }, [visibleEvents]);

  const iconTileStyle = (tone: Tone): CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: "var(--radius-md)",
    background: TONE_BG[tone],
    color: TONE_FG[tone],
    border: `1px solid ${TONE_BORDER[tone]}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    position: "relative",
    zIndex: 1,
  });

  const sparkValues = [0.2, 0.35, 0.28, 0.4, 0.55, 0.48, 0.62, 0.7, 0.66, 0.82, 0.9, 0.95];

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Team"
        title="Activity"
        sub="Everything happening across your workspace — pushes, reviews, policies, incidents, agent runs, billing. One stream."
      />
      <div className="demo-app__body">
        {/* ==================== FILTER BAR ==================== */}
        <div className="demo-sectionbar">
          <div
            className="demo-billing-toggle"
            role="tablist"
            aria-label="Event category"
            style={{ flexWrap: "wrap" }}
          >
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                className={activeFilter === f ? "is-active" : ""}
                aria-pressed={activeFilter === f}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <span className="demo-sectionbar__spacer" />
          <select
            className="demo-select"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{ width: 150 }}
            aria-label="Date range"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom</option>
          </select>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid var(--border)",
              padding: "0 10px",
              height: 28,
              borderRadius: "var(--radius-sm)",
              background: "var(--bg)",
              color: "var(--fg-subtle)",
              fontSize: "var(--fs-xs)",
            }}
          >
            <Search size={13} strokeWidth={2} aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by person or text"
              aria-label="Filter events"
              style={{
                border: 0,
                outline: "none",
                background: "transparent",
                color: "var(--fg)",
                font: "inherit",
                width: 180,
              }}
            />
          </div>
          <button className="demo-btn demo-btn--ghost">
            <Download size={13} strokeWidth={1.8} aria-hidden /> Export
          </button>
          <button className="demo-btn demo-btn--ghost">
            <Rss size={13} strokeWidth={1.8} aria-hidden /> Subscribe via RSS
          </button>
        </div>

        {/* ==================== SUMMARY STATS ==================== */}
        <div className="demo-grid-3" style={{ marginBottom: "var(--space-4)" }}>
          <StatCard
            label="Events today"
            value="248"
            icon={<Activity size={12} strokeWidth={1.8} aria-hidden />}
            delta="+34 vs yesterday"
            deltaTone="up"
            chart={<Sparkline values={sparkValues} width={240} height={36} color="var(--success)" />}
          />
          <StatCard
            label="Most active"
            value="Ada Lovelace"
            icon={<UserCheck size={12} strokeWidth={1.8} aria-hidden />}
            delta="42 events today"
          />
          <StatCard
            label="Alert events"
            value="3"
            icon={<AlertTriangle size={12} strokeWidth={1.8} aria-hidden />}
            delta="2 warnings · 1 danger"
          />
        </div>

        {/* ==================== TIMELINE FEED ==================== */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            paddingLeft: "var(--space-1)",
          }}
        >
          {/* Vertical connector line */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 20,
              top: 60,
              bottom: 40,
              width: 2,
              background: "var(--border)",
            }}
          />

          {grouped.map(([day, items]) => (
            <section key={day}>
              <h2
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  margin: 0,
                  padding: "var(--space-2) 0 var(--space-1h)",
                  background: "var(--bg)",
                  fontSize: "var(--fs-10)",
                  fontWeight: "var(--fw-bold)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--fg-subtle)",
                  borderBottom: "1px dashed var(--border)",
                }}
              >
                {day}
              </h2>

              {items.map((event) => {
                const Icon = ICON_FOR[event.kind];
                const isExpanded = expandedId === event.id;
                const hasExpansion = event.expandable !== undefined;
                return (
                  <article
                    key={event.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px minmax(0, 1fr) auto",
                      gap: "var(--space-3)",
                      padding: "var(--space-3) 0",
                      position: "relative",
                      borderBottom: "1px dashed var(--border)",
                    }}
                  >
                    <span style={iconTileStyle(event.tone)}>
                      <Icon size={15} strokeWidth={1.8} aria-hidden />
                    </span>

                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                          flexWrap: "wrap",
                          fontSize: "var(--fs-sm)",
                          color: "var(--fg)",
                          lineHeight: "var(--lh-snug)",
                        }}
                      >
                        <ActorAvatar name={event.actor} />
                        <strong style={{ fontWeight: "var(--fw-semibold)" }}>
                          {event.actor}
                        </strong>
                        <span style={{ color: "var(--fg-muted)" }}>{event.body}</span>
                      </div>
                      {hasExpansion && isExpanded && (
                        <div
                          style={{
                            marginTop: "var(--space-2)",
                            padding: "var(--space-2h) var(--space-3)",
                            background: "var(--bg-subtle)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          {event.expandable}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                      }}
                    >
                      {event.target && (
                        <button
                          type="button"
                          className="demo-btn demo-btn--ghost"
                          onClick={() => nav.navigate(event.target!.navId)}
                          style={{ padding: "2px 8px" }}
                        >
                          <MessageCircle size={11} strokeWidth={1.8} aria-hidden /> Open
                        </button>
                      )}
                      <time
                        dateTime={event.time}
                        title={event.time}
                        style={{
                          fontSize: "var(--fs-10)",
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--fg-subtle)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {event.relative}
                      </time>
                      {hasExpansion ? (
                        <button
                          type="button"
                          aria-label={isExpanded ? "Collapse details" : "Expand details"}
                          aria-expanded={isExpanded}
                          className="demo-btn demo-btn--ghost"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : event.id)
                          }
                          style={{ padding: 0, width: 24, height: 24 }}
                        >
                          {isExpanded ? (
                            <ChevronUp size={13} strokeWidth={1.8} aria-hidden />
                          ) : (
                            <ChevronDown size={13} strokeWidth={1.8} aria-hidden />
                          )}
                        </button>
                      ) : (
                        <span style={{ width: 24 }} aria-hidden />
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          ))}

          {visibleEvents.length === 0 && (
            <div className="demo-empty" style={{ marginTop: "var(--space-4)" }}>
              <div className="demo-empty__title">No matching events</div>
              <div className="demo-empty__hint">
                Try removing filters or changing the date range.
              </div>
            </div>
          )}
        </div>

        {/* ==================== PAGINATION ==================== */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "var(--space-4)",
          }}
        >
          <button
            type="button"
            className="demo-btn demo-btn--ghost"
            style={{
              border: "1px dashed var(--border)",
              padding: "var(--space-2) var(--space-4)",
            }}
          >
            Load older events
          </button>
        </div>
      </div>
    </div>
  );
}
