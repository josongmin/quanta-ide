import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Code,
  Lock,
  LogIn,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  Webhook,
  Zap,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface RetentionOption {
  value: string;
  label: string;
  days: number; // sentinel -1 = forever
  locked?: boolean;
}

interface Category {
  id: string;
  title: string;
  description: string;
  count: string;
  enabled: boolean;
  defaultValue: string;
  options: RetentionOption[];
  Icon: typeof ScrollText;
}

const CATEGORIES: Category[] = [
  {
    id: "audit-log",
    title: "Audit log",
    description: "Compliance history of security-relevant events.",
    count: "382 entries",
    enabled: true,
    defaultValue: "1y",
    Icon: ScrollText,
    options: [
      { value: "30d", label: "30d", days: 30 },
      { value: "90d", label: "90d", days: 90 },
      { value: "1y", label: "1 year", days: 365 },
      { value: "2y", label: "2 years", days: 730 },
      { value: "forever", label: "Forever", days: -1, locked: true },
    ],
  },
  {
    id: "analysis-runs",
    title: "Analysis runs",
    description: "Code analysis execution history and results.",
    count: "12k runs",
    enabled: true,
    defaultValue: "30d",
    Icon: Zap,
    options: [
      { value: "7d", label: "7d", days: 7 },
      { value: "30d", label: "30d", days: 30 },
      { value: "90d", label: "90d", days: 90 },
      { value: "1y", label: "1 year", days: 365, locked: true },
    ],
  },
  {
    id: "agent-conversations",
    title: "Agent conversations",
    description: "Chat transcripts with embedded agents.",
    count: "1,842",
    enabled: true,
    defaultValue: "7d",
    Icon: MessageSquare,
    options: [
      { value: "7d", label: "7d", days: 7 },
      { value: "30d", label: "30d", days: 30 },
      { value: "90d", label: "90d", days: 90 },
      { value: "forever", label: "Forever", days: -1, locked: true },
    ],
  },
  {
    id: "code-snapshots",
    title: "Code snapshots",
    description: "Point-in-time captures of workspace source.",
    count: "8.4 GB",
    enabled: true,
    defaultValue: "7d",
    Icon: Code,
    options: [
      { value: "24h", label: "24h", days: 1 },
      { value: "7d", label: "7d", days: 7 },
      { value: "30d", label: "30d", days: 30 },
      { value: "never", label: "Never deleted", days: -1, locked: true },
    ],
  },
  {
    id: "policy-violations",
    title: "Policy violations",
    description: "Findings raised by custom rules across the workspace.",
    count: "221",
    enabled: true,
    defaultValue: "1y",
    Icon: ShieldCheck,
    options: [
      { value: "30d", label: "30d", days: 30 },
      { value: "90d", label: "90d", days: 90 },
      { value: "1y", label: "1 year", days: 365 },
      { value: "forever", label: "Forever", days: -1, locked: true },
    ],
  },
  {
    id: "webhook-deliveries",
    title: "Webhook deliveries",
    description: "Outbound event deliveries with status and payload.",
    count: "84k events",
    enabled: true,
    defaultValue: "7d",
    Icon: Webhook,
    options: [
      { value: "7d", label: "7d", days: 7 },
      { value: "30d", label: "30d", days: 30 },
      { value: "90d", label: "90d", days: 90, locked: true },
    ],
  },
  {
    id: "login-history",
    title: "Login history",
    description: "Sign-in attempts with device, IP, and outcome.",
    count: "1,098 logins",
    enabled: true,
    defaultValue: "1y",
    Icon: LogIn,
    options: [
      { value: "30d", label: "30d", days: 30 },
      { value: "90d", label: "90d", days: 90 },
      { value: "1y", label: "1 year", days: 365 },
      { value: "forever", label: "Forever", days: -1, locked: true },
    ],
  },
  {
    id: "notification-inbox",
    title: "Notification inbox",
    description: "In-app notifications shown to workspace members.",
    count: "312",
    enabled: true,
    defaultValue: "30d",
    Icon: Bell,
    options: [
      { value: "unread-forever", label: "Unread forever", days: -1 },
      { value: "30d", label: "30d", days: 30 },
      { value: "90d", label: "90d", days: 90 },
    ],
  },
];

function formatDeletionDate(days: number): string {
  if (days < 0) return "never";
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function DataRetentionPage() {
  const [selections, setSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c.id, c.defaultValue])),
  );
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c.id, c.enabled])),
  );

  const activeCount = Object.values(enabled).filter(Boolean).length;

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Security"
        title="Data retention"
        sub="Decide how long each data class is kept before automatic purge. Longer retention is available on Enterprise."
      />
      <div className="demo-app__body">
        {/* Summary stats */}
        <div className="demo-grid-3" style={{ marginBottom: "var(--space-4)" }}>
          <div className="demo-stat">
            <div className="demo-stat__label">Active categories</div>
            <div className="demo-stat__value">
              {activeCount} / {CATEGORIES.length}
            </div>
            <div className="demo-stat__sub">Toggle off to stop collecting</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Storage used</div>
            <div className="demo-stat__value">482 MB</div>
            <div className="demo-stat__sub">Across all retention buckets</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Next scheduled purge</div>
            <div className="demo-stat__value">in 2 days</div>
            <div className="demo-stat__sub">2026-04-21 · 03:00 UTC</div>
          </div>
        </div>

        {/* Per-category rows — list style, dashed dividers */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg)",
            overflow: "hidden",
          }}
        >
          {CATEGORIES.map((cat, idx) => {
            const Icon = cat.Icon;
            const selected = selections[cat.id] ?? cat.defaultValue;
            const selectedOption =
              cat.options.find((o) => o.value === selected) ??
              cat.options[0];
            const deletionDate = formatDeletionDate(selectedOption.days);
            const isEnabled = enabled[cat.id] ?? cat.enabled;
            const neverDeleted = selectedOption.days < 0;

            return (
              <div
                key={cat.id}
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  borderTop:
                    idx === 0 ? "none" : "1px dashed var(--border)",
                  opacity: isEnabled ? 1 : 0.55,
                }}
              >
                <header
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: "var(--space-2h)",
                    marginBottom: "var(--space-2h)",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-muted)",
                      color: "var(--fg-muted)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={14} strokeWidth={1.8} />
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: "var(--fs-sm)",
                        fontWeight: "var(--fw-semibold)",
                      }}
                    >
                      {cat.title}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--fs-xs)",
                        color: "var(--fg-subtle)",
                        marginTop: "var(--space-0h)",
                      }}
                    >
                      {cat.description}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <span className="demo-badge">{cat.count}</span>
                    <label className="demo-toggle">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) =>
                          setEnabled((m) => ({
                            ...m,
                            [cat.id]: e.target.checked,
                          }))
                        }
                      />
                      <span className="demo-toggle__track" />
                    </label>
                  </div>
                </header>

                {/* Row: segmented control + deletion date */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    marginTop: "var(--space-2)",
                  }}
                >
                  {/* iOS-style segmented control */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${cat.options.length}, 1fr)`,
                      gap: 2,
                      padding: 2,
                      background: "var(--bg-muted)",
                      borderRadius: "var(--radius-sm)",
                      flex: 1,
                    }}
                  >
                    {cat.options.map((opt) => {
                      const isSelected = selected === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            !opt.locked &&
                            setSelections((m) => ({
                              ...m,
                              [cat.id]: opt.value,
                            }))
                          }
                          disabled={opt.locked}
                          style={{
                            padding: "var(--space-1h) var(--space-1h)",
                            border: "none",
                            background: isSelected
                              ? "var(--bg)"
                              : "transparent",
                            color: isSelected
                              ? "var(--fg)"
                              : "var(--fg-muted)",
                            borderRadius: "calc(var(--radius-sm) - 2px)",
                            fontSize: "var(--fs-xs)",
                            fontWeight: isSelected
                              ? "var(--fw-semibold)"
                              : "var(--fw-medium)",
                            cursor: opt.locked ? "not-allowed" : "pointer",
                            opacity: opt.locked ? 0.5 : 1,
                            transition: "all 0.12s ease",
                            position: "relative",
                            boxShadow: isSelected
                              ? "0 1px 2px rgba(0,0,0,0.06)"
                              : "none",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                          }}
                          aria-label={
                            opt.locked
                              ? `${opt.label} (Enterprise plan)`
                              : opt.label
                          }
                        >
                          {opt.label}
                          {opt.locked && (
                            <Lock
                              size={9}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Deletion date — inline muted */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-1)",
                      fontSize: "var(--fs-10)",
                      color: "var(--fg-subtle)",
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.04em",
                      whiteSpace: "nowrap",
                      minWidth: 130,
                      justifyContent: "flex-end",
                    }}
                  >
                    <ArrowRight size={10} strokeWidth={1.8} aria-hidden="true" />
                    {neverDeleted ? "never deleted" : `delete ${deletionDate}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Warn callout */}
        <div
          style={{
            marginTop: "var(--space-4)",
            padding: "var(--space-3h) var(--space-4)",
            background: "var(--bg-warn-subtle)",
            border: "1px solid var(--border-warn-subtle)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-2h)",
          }}
        >
          <AlertTriangle
            size={16}
            strokeWidth={1.8}
            style={{
              color: "var(--warn)",
              marginTop: "var(--space-0h)",
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: "var(--fs-xs)",
              color: "var(--fg)",
              lineHeight: "var(--lh-relaxed)",
            }}
          >
            <strong>Purges are permanent.</strong> Reducing retention schedules
            deletion within 24 hours. Export sensitive categories first from{" "}
            <em>Security → Data export</em>.
          </div>
        </div>

        {/* Foot */}
        <div
          style={{
            marginTop: "var(--space-4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "var(--space-3)",
          }}
        >
          <span
            aria-live="polite"
            style={{
              fontSize: "var(--fs-10)",
              color: "var(--fg-subtle)",
            }}
          >
            Last saved 2 hours ago
          </span>
          <button className="demo-btn demo-btn--primary">Save changes</button>
        </div>
      </div>
    </div>
  );
}
