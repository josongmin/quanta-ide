import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  Plus,
  Search,
} from "lucide-react";
import { useDemoNav } from "../../DemoPage";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { initials, pickPalette } from "../../internal/avatar-utils";

type TicketStatus = "open" | "awaiting_you" | "resolved";
type TicketPriority = "critical" | "high" | "normal" | "low";
type TabKey = "all" | "open" | "awaiting_you" | "resolved";

interface Ticket {
  id: string;
  subject: string;
  preview: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: string;
  lastUpdate: string;
  created: string;
  unread?: boolean;
  replies: number;
}

const TICKETS: Ticket[] = [
  {
    id: "TK-2026-00142",
    subject: "Analysis stuck on CI for PR #482",
    preview: "Runner picks up the job but the analyses step hangs at 00:12 with no logs…",
    status: "awaiting_you",
    priority: "high",
    assignee: "Mei Zhang",
    lastUpdate: "2 hours ago",
    created: "2026-04-18",
    unread: true,
    replies: 4,
  },
  {
    id: "TK-2026-00138",
    subject: "API rate limit on /v1/analyses exceeded during backfill",
    preview: "We are getting 429s on the analyses endpoint even though we are under 60 rpm…",
    status: "open",
    priority: "critical",
    assignee: "Haruto Ito",
    lastUpdate: "47 minutes ago",
    created: "2026-04-17",
    replies: 2,
  },
  {
    id: "TK-2026-00131",
    subject: "Request: Python 3.13 support for engine runtime",
    preview: "Our monorepo has moved to 3.13 and the engine still pins 3.12 — any ETA on 3.13…",
    status: "open",
    priority: "normal",
    assignee: "Grace Hopper",
    lastUpdate: "yesterday",
    created: "2026-04-16",
    replies: 1,
  },
  {
    id: "TK-2026-00129",
    subject: "Invoice VAT mismatch for 2026-03 billing cycle",
    preview: "The VAT line shows 10% but our Korean entity should be exempt on export…",
    status: "awaiting_you",
    priority: "normal",
    assignee: "Ada Lovelace",
    lastUpdate: "3 days ago",
    created: "2026-04-12",
    replies: 3,
  },
  {
    id: "TK-2026-00124",
    subject: "Canvas WebGL flicker on Windows with multi-monitor DPI",
    preview: "Tiles snap-flicker for ~200ms when dragging across the external display…",
    status: "open",
    priority: "low",
    assignee: "Linus Torvalds",
    lastUpdate: "4 days ago",
    created: "2026-04-10",
    replies: 5,
  },
  {
    id: "TK-2026-00118",
    subject: "MCP handshake rejected with 'unsupported transport'",
    preview: "Our local MCP server is advertised as stdio but Quanta responds with…",
    status: "open",
    priority: "high",
    assignee: "Katherine Johnson",
    lastUpdate: "5 days ago",
    created: "2026-04-08",
    replies: 2,
  },
  {
    id: "TK-2026-00111",
    subject: "Need SAML metadata rotation before April 30",
    preview: "Our IdP will rotate the signing certificate and we need a staged switchover…",
    status: "resolved",
    priority: "normal",
    assignee: "Margaret Hamilton",
    lastUpdate: "7 days ago",
    created: "2026-04-04",
    replies: 6,
  },
  {
    id: "TK-2026-00107",
    subject: "Export includes deleted workspace data in ZIP bundle",
    preview: "A full export bundle still references symbols from a workspace that was deleted…",
    status: "resolved",
    priority: "critical",
    assignee: "Barbara Liskov",
    lastUpdate: "10 days ago",
    created: "2026-04-02",
    replies: 8,
  },
];

const STATUS_BADGE: Record<TicketStatus, { cls: string; label: string }> = {
  open: { cls: "demo-badge demo-badge--accent", label: "Open" },
  awaiting_you: { cls: "demo-badge demo-badge--warn", label: "Awaiting you" },
  resolved: { cls: "demo-badge", label: "Resolved" },
};

const PRIORITY_BADGE: Record<
  TicketPriority,
  { cls: string; label: string; style?: React.CSSProperties }
> = {
  critical: { cls: "demo-badge demo-badge--danger", label: "Critical" },
  high: { cls: "demo-badge demo-badge--warn", label: "High" },
  normal: { cls: "demo-badge", label: "Normal" },
  low: {
    cls: "demo-badge",
    label: "Low",
    style: { opacity: 0.6 },
  },
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "awaiting_you", label: "Awaiting reply" },
  { key: "resolved", label: "Resolved" },
];

export function TicketListPage() {
  const nav = useDemoNav();
  const [tab, setTab] = useState<TabKey>("all");
  const [q, setQ] = useState("");
  const [hoverId, setHoverId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return TICKETS.filter((t) => {
      if (tab === "open" && t.status !== "open") return false;
      if (tab === "awaiting_you" && t.status !== "awaiting_you") return false;
      if (tab === "resolved" && t.status !== "resolved") return false;
      if (!needle) return true;
      return (
        t.subject.toLowerCase().includes(needle) ||
        t.preview.toLowerCase().includes(needle) ||
        t.id.toLowerCase().includes(needle) ||
        t.assignee.toLowerCase().includes(needle)
      );
    });
  }, [tab, q]);

  const openDetail = (id: string) => {
    // eslint-disable-next-line no-console
    console.log("[demo] open ticket detail", id);
    nav.navigate("support.ticket");
  };

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Support"
        title="Support tickets"
        sub="Your open support conversations with the Quanta team. Response SLA varies by plan."
      />
      <div className="demo-app__body">
        {/* Stats */}
        <div className="demo-grid-3" style={{ marginBottom: "var(--space-4)" }}>
          <div className="demo-stat">
            <div className="demo-stat__label">Open tickets</div>
            <div className="demo-stat__value">3</div>
            <div className="demo-stat__delta">Across 2 products</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Awaiting you</div>
            <div className="demo-stat__value">1</div>
            <div className="demo-stat__delta is-up">Reply within 24h to keep SLA</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Median response</div>
            <div className="demo-stat__value">12 min</div>
            <div className="demo-stat__delta">Last 30 days</div>
          </div>
        </div>

        {/* Section bar */}
        <div className="demo-sectionbar">
          <div className="demo-billing-toggle" style={{ marginBottom: 0 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={tab === t.key ? "is-active" : ""}
                aria-pressed={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="demo-sectionbar__spacer" />
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              border: "1px solid var(--border)",
              padding: "0 var(--space-3)",
              height: 32,
              borderRadius: "var(--radius-md)",
              background: "var(--bg)",
              color: "var(--fg-subtle)",
              fontSize: "var(--fs-sm)",
              minWidth: 260,
              cursor: "text",
            }}
          >
            <Search size={14} strokeWidth={1.8} aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tickets, IDs, people"
              aria-label="Search tickets"
              style={{
                border: 0,
                outline: "none",
                background: "transparent",
                color: "var(--fg)",
                font: "inherit",
                fontSize: "var(--fs-sm)",
                flex: 1,
                minWidth: 0,
              }}
            />
          </label>
          <button
            type="button"
            className="demo-btn demo-btn--primary"
            style={{ padding: "0 var(--space-3)", height: 32 }}
            aria-label="Create new ticket"
          >
            <Plus size={13} strokeWidth={1.8} /> New ticket
          </button>
        </div>

        {/* Table */}
        <div className="demo-block">
          <div className="demo-block__body demo-block__body--flush">
            {filtered.length === 0 ? (
              <div className="demo-empty">
                <LifeBuoy size={28} strokeWidth={1.5} aria-hidden="true" />
                <div className="demo-empty__title">No tickets match</div>
                <div className="demo-empty__hint">
                  Try a different filter or search term.
                </div>
              </div>
            ) : (
              <table className="demo-table">
                <thead>
                  <tr>
                    <th style={{ width: "44%" }}>Subject</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Assignee</th>
                    <th>Last update</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const pal = pickPalette(t.assignee);
                    const status = STATUS_BADGE[t.status];
                    const priority = PRIORITY_BADGE[t.priority];
                    const isHover = hoverId === t.id;
                    return (
                      <tr
                        key={t.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Open ticket ${t.id}: ${t.subject}`}
                        onClick={() => openDetail(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDetail(t.id);
                          }
                        }}
                        onMouseEnter={() => setHoverId(t.id)}
                        onMouseLeave={() => setHoverId(null)}
                        style={{
                          cursor: "pointer",
                          background: isHover ? "var(--bg-hover)" : undefined,
                        }}
                      >
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--space-2)",
                            }}
                          >
                            {t.unread && (
                              <span
                                aria-label="Unread"
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: "var(--accent)",
                                  flex: "0 0 auto",
                                }}
                              />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: "var(--fs-sm)",
                                  fontWeight: "var(--fw-semibold)",
                                  color: "var(--fg)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {t.subject}
                              </div>
                              <div
                                style={{
                                  fontSize: "var(--fs-10)",
                                  color: "var(--fg-subtle)",
                                  fontFamily: "var(--font-mono)",
                                  marginTop: 2,
                                  letterSpacing: "0.02em",
                                }}
                              >
                                {t.id} · {t.replies} replies
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={status.cls}>{status.label}</span>
                        </td>
                        <td>
                          <span className={priority.cls} style={priority.style}>
                            {priority.label}
                          </span>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "var(--space-2)",
                            }}
                          >
                            <span
                              className="demo-avatar"
                              style={{
                                background: pal.bg,
                                color: pal.fg,
                                width: 24,
                                height: 24,
                                fontSize: 10,
                              }}
                              aria-hidden="true"
                            >
                              {initials(t.assignee)}
                            </span>
                            <span style={{ fontSize: "var(--fs-sm)" }}>
                              {t.assignee}
                            </span>
                          </div>
                        </td>
                        <td style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>
                          {t.lastUpdate}
                        </td>
                        <td
                          style={{
                            color: "var(--fg-subtle)",
                            fontSize: "var(--fs-xs)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {t.created}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="demo-block__foot">
            <span
              style={{
                marginRight: "auto",
                fontSize: "var(--fs-xs)",
                color: "var(--fg-subtle)",
              }}
            >
              Showing 1–{filtered.length} of 24 tickets
            </span>
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              style={{ padding: "0 var(--space-2h)", height: 28 }}
              aria-label="Previous page"
              disabled
            >
              <ChevronLeft size={13} strokeWidth={1.8} /> Prev
            </button>
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              style={{ padding: "0 var(--space-2h)", height: 28 }}
              aria-label="Next page"
            >
              Next <ChevronRight size={13} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
