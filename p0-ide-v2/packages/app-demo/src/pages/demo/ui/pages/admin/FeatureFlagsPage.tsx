import { useState } from "react";
import type { CSSProperties } from "react";
import {
  Flag,
  Zap,
  FlaskConical,
  Skull,
  History,
  ShieldCheck,
  Layers,
  Brain,
  DollarSign,
  Moon,
  Package,
  CircleDot,
  Plus,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { Sparkline } from "../../internal/Sparkline";

type Env = "prod" | "staging" | "local";
type FlagStatus = "on" | "rolling" | "experiment" | "canary" | "draft" | "targeted" | "killed";

interface Variant {
  name: string;
  traffic: number; // 0..1
  cvr: number; // 0..1
  pValue: number;
}

interface Flag {
  key: string;
  description: string;
  rollout: Record<Env, number>; // 0..100
  variants: string[];
  variantPerf?: Variant[];
  modified: string;
  status: FlagStatus;
  Icon: typeof Flag;
  tone: string;
  rules?: Array<{ when: string; serve: string }>;
  overrides?: Array<{ email: string; variant: string; since: string }>;
  evaluations?: number[];
  targetNote?: string;
}

const FLAGS: Flag[] = [
  {
    key: "canvas.multi_file",
    description: "Multi-file Code Universe — all files in one canvas",
    rollout: { prod: 100, staging: 100, local: 100 },
    variants: ["on", "off"],
    modified: "3d ago",
    status: "on",
    Icon: Layers,
    tone: "var(--success)",
    rules: [
      { when: "workspace.plan IS Enterprise", serve: "on" },
      { when: "everyone else", serve: "on" },
    ],
    overrides: [],
    evaluations: [0.3, 0.35, 0.4, 0.45, 0.5, 0.52, 0.58, 0.6, 0.65, 0.7, 0.72, 0.8],
  },
  {
    key: "agent.screen_share",
    description: "Agent can stream your screen for debug sessions",
    rollout: { prod: 34, staging: 100, local: 100 },
    variants: ["on", "off"],
    variantPerf: [
      { name: "on", traffic: 0.34, cvr: 0.412, pValue: 0.018 },
      { name: "off (control)", traffic: 0.66, cvr: 0.296, pValue: 1 },
    ],
    modified: "8h ago",
    status: "rolling",
    Icon: Zap,
    tone: "var(--warn)",
    rules: [
      { when: "workspace.plan IS Enterprise", serve: "on" },
      { when: "workspace.plan IS Team AND workspace.created AFTER 2025-10-01", serve: "on" },
      { when: "everyone else", serve: "off" },
    ],
    overrides: [
      { email: "ada@acme.com", variant: "on", since: "2026-03-11" },
      { email: "alan@acme.com", variant: "on", since: "2026-03-12" },
      { email: "mia@beta.co", variant: "off", since: "2026-04-02" },
    ],
    evaluations: [0.4, 0.45, 0.42, 0.5, 0.55, 0.6, 0.58, 0.65, 0.7, 0.74, 0.8, 0.86],
  },
  {
    key: "policy.custom_dsl",
    description: "Custom policy DSL v2 — new syntax, faster evaluator",
    rollout: { prod: 12, staging: 50, local: 100 },
    variants: ["control", "v2", "v3"],
    variantPerf: [
      { name: "control", traffic: 0.88, cvr: 0.214, pValue: 1 },
      { name: "v2", traffic: 0.08, cvr: 0.261, pValue: 0.07 },
      { name: "v3", traffic: 0.04, cvr: 0.289, pValue: 0.012 },
    ],
    modified: "1d ago",
    status: "experiment",
    Icon: FlaskConical,
    tone: "var(--accent)",
    evaluations: [0.35, 0.4, 0.38, 0.42, 0.45, 0.5, 0.48, 0.52, 0.55, 0.58, 0.6, 0.62],
  },
  {
    key: "ai.auto_route",
    description: "Automatically route to the cheapest capable model",
    rollout: { prod: 5, staging: 100, local: 100 },
    variants: ["on", "off"],
    modified: "2h ago",
    status: "canary",
    Icon: Brain,
    tone: "var(--accent)",
    evaluations: [0.2, 0.25, 0.3, 0.28, 0.35, 0.4, 0.38, 0.45, 0.5, 0.52, 0.58, 0.6],
  },
  {
    key: "engine.risk.v4",
    description: "Risk engine v4 — graph-aware propagation",
    rollout: { prod: 0, staging: 20, local: 100 },
    variants: ["v3", "v4"],
    modified: "4d ago",
    status: "draft",
    Icon: ShieldCheck,
    tone: "var(--fg-muted)",
    evaluations: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    key: "ui.dark_mode_v2",
    description: "Refined dark palette with OLED black option",
    rollout: { prod: 100, staging: 100, local: 100 },
    variants: ["on", "off"],
    modified: "12d ago",
    status: "on",
    Icon: Moon,
    tone: "var(--success)",
    evaluations: [0.6, 0.65, 0.7, 0.72, 0.75, 0.78, 0.8, 0.82, 0.85, 0.86, 0.88, 0.9],
  },
  {
    key: "billing.yearly_only",
    description: "Hide monthly pricing for Enterprise org prospects",
    rollout: { prod: 100, staging: 100, local: 100 },
    variants: ["on", "off"],
    modified: "9d ago",
    status: "targeted",
    Icon: DollarSign,
    tone: "var(--accent)",
    targetNote: "Enterprise only",
    evaluations: [0.1, 0.12, 0.14, 0.13, 0.15, 0.16, 0.18, 0.2, 0.22, 0.25, 0.24, 0.28],
  },
  {
    key: "legacy.sso_v1",
    description: "Old SAML implementation (XML-only)",
    rollout: { prod: 0, staging: 0, local: 0 },
    variants: ["on", "off"],
    modified: "31d ago",
    status: "killed",
    Icon: Skull,
    tone: "var(--danger)",
    evaluations: [0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01, 0, 0, 0, 0],
  },
];

function statusBadge(status: FlagStatus): { label: string; className: string } {
  switch (status) {
    case "on":
      return { label: "On", className: "demo-badge demo-badge--success" };
    case "rolling":
      return { label: "Rolling out", className: "demo-badge demo-badge--warn" };
    case "experiment":
      return { label: "Experiment", className: "demo-badge demo-badge--accent" };
    case "canary":
      return { label: "Canary", className: "demo-badge demo-badge--accent" };
    case "draft":
      return { label: "Draft", className: "demo-badge" };
    case "targeted":
      return { label: "Targeted", className: "demo-badge demo-badge--accent" };
    case "killed":
      return { label: "Killed", className: "demo-badge demo-badge--danger" };
  }
}

function progressTone(status: FlagStatus): string {
  if (status === "rolling") return "demo-progress demo-progress--warn";
  if (status === "canary" || status === "experiment" || status === "targeted")
    return "demo-progress demo-progress--accent";
  if (status === "killed") return "demo-progress demo-progress--danger";
  return "demo-progress";
}

function iconTile(tone: string): CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: "var(--radius-md)",
    background: "var(--bg-subtle)",
    color: tone,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    border: "1px solid var(--border)",
  };
}

export function FeatureFlagsPage() {
  const [env, setEnv] = useState<Env>("prod");
  const [selectedKey, setSelectedKey] = useState<string>("agent.screen_share");
  const [rolloutDraft, setRolloutDraft] = useState<number>(34);

  const selected = FLAGS.find((f) => f.key === selectedKey) ?? FLAGS[0];

  const handleSelect = (f: Flag) => {
    setSelectedKey(f.key);
    setRolloutDraft(f.rollout[env]);
  };

  const changeEnv = (next: Env) => {
    setEnv(next);
    setRolloutDraft(selected.rollout[next]);
  };

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Admin"
        title="Feature flags"
        sub="Gradual rollouts, A/B tests, and kill-switches. Changes propagate within 30 seconds."
      />
      <div className="demo-app__body">
        {/* ==================== STATS ==================== */}
        <div className="demo-grid-3" style={{ marginBottom: "var(--space-4)" }}>
          <div className="demo-stat">
            <div className="demo-stat__label">Active flags</div>
            <div className="demo-stat__value">18</div>
            <div className="demo-stat__delta is-up">+2 this week</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Experiments running</div>
            <div className="demo-stat__value">4</div>
            <div className="demo-stat__delta">3 statistically significant</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Evaluations today</div>
            <div className="demo-stat__value">1.4M</div>
            <div className="demo-stat__delta is-up">p95 latency 2.1ms</div>
          </div>
        </div>

        {/* ==================== ENV TOGGLE ==================== */}
        <div className="demo-sectionbar">
          <div className="demo-sectionbar__title">Flags</div>
          <div className="demo-sectionbar__desc">Rollout data shown for selected environment</div>
          <span className="demo-sectionbar__spacer" />
          <div className="demo-billing-toggle" role="tablist" aria-label="Environment">
            {(
              [
                { id: "prod", label: "Production" },
                { id: "staging", label: "Staging" },
                { id: "local", label: "Local" },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                className={env === o.id ? "is-active" : ""}
                onClick={() => changeEnv(o.id)}
                aria-pressed={env === o.id}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button className="demo-btn demo-btn--primary">
            <Plus size={12} strokeWidth={1.8} /> New flag
          </button>
        </div>

        {/* ==================== FLAGS TABLE ==================== */}
        <div className="demo-block">
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th style={{ width: 38 }}></th>
                  <th>Key</th>
                  <th>Description</th>
                  <th style={{ width: 220 }}>Rollout ({env})</th>
                  <th>Variants</th>
                  <th>Modified</th>
                  <th>Status</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {FLAGS.map((f) => {
                  const Icon = f.Icon;
                  const rolloutVal = f.rollout[env];
                  const isSel = f.key === selectedKey;
                  const sb = statusBadge(f.status);
                  const progCls = progressTone(f.status);
                  const keyStyle: CSSProperties =
                    f.status === "killed"
                      ? {
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          textDecoration: "line-through",
                          color: "var(--fg-subtle)",
                        }
                      : {
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--fg)",
                        };
                  return (
                    <tr
                      key={f.key}
                      onClick={() => handleSelect(f)}
                      style={{
                        cursor: "pointer",
                        background: isSel ? "var(--bg-subtle)" : undefined,
                      }}
                      aria-selected={isSel}
                    >
                      <td>
                        <span style={iconTile(f.tone)}>
                          <Icon size={14} strokeWidth={1.8} />
                        </span>
                      </td>
                      <td style={keyStyle}>{f.key}</td>
                      <td style={{ color: "var(--fg-muted)" }}>{f.description}</td>
                      <td>
                        <div className={progCls}>
                          <div className="demo-progress__bar">
                            <div
                              className="demo-progress__fill"
                              style={{ width: `${rolloutVal}%` }}
                            />
                          </div>
                          <div className="demo-progress__meta">
                            <span>{rolloutVal}%</span>
                            {f.targetNote && env === "prod" && (
                              <span>{f.targetNote}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {f.variants.map((v) => (
                            <span
                              key={v}
                              className="demo-badge"
                              style={{
                                fontFamily: "var(--font-mono)",
                                textTransform: "none",
                                letterSpacing: 0,
                              }}
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ color: "var(--fg-subtle)" }}>{f.modified}</td>
                      <td>
                        <span className={sb.className}>{sb.label}</span>
                      </td>
                      <td>
                        <ChevronRight
                          size={14}
                          strokeWidth={1.8}
                          style={{
                            color: isSel ? "var(--fg)" : "var(--fg-subtle)",
                            transform: isSel ? "rotate(90deg)" : undefined,
                            transition: "transform 0.12s ease",
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ==================== DETAIL PANEL ==================== */}
        <section
          style={{
            marginTop: "var(--space-4)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-4)",
            background: "var(--bg)",
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)",
              paddingBottom: "var(--space-3)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={iconTile(selected.tone)}>
              <selected.Icon size={14} strokeWidth={1.8} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-md)",
                  fontWeight: 600,
                }}
              >
                {selected.key}
              </div>
              <div
                style={{
                  fontSize: "var(--fs-xs)",
                  color: "var(--fg-subtle)",
                }}
              >
                {selected.description}
              </div>
            </div>
            <span className={statusBadge(selected.status).className}>
              {statusBadge(selected.status).label}
            </span>
            <button className="demo-btn demo-btn--ghost">
              <History size={12} strokeWidth={1.8} /> View history
            </button>
            <button className="demo-btn demo-btn--danger">
              <Skull size={12} strokeWidth={1.8} /> Kill switch
            </button>
          </header>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr",
              gap: "var(--space-4)",
            }}
          >
            {/* -------- LEFT: Rollout controls -------- */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
              <div>
                <h4
                  style={{
                    fontSize: "var(--fs-10)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--fg-subtle)",
                    fontWeight: 700,
                    margin: "0 0 var(--space-2)",
                  }}
                >
                  Rollout — {env}
                </h4>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-3)",
                    background: "var(--bg-subtle)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) 80px auto",
                      gap: "var(--space-3)",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={rolloutDraft}
                      onChange={(e) => setRolloutDraft(Number(e.target.value))}
                      aria-label="Rollout percent"
                    />
                    <div
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "4px 8px",
                        background: "var(--bg)",
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        fontSize: "var(--fs-sm)",
                      }}
                    >
                      {rolloutDraft}%
                    </div>
                    <button className="demo-btn demo-btn--primary">
                      Save rollout
                    </button>
                  </div>
                  <div
                    style={{
                      marginTop: "var(--space-2h)",
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg-subtle)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <CircleDot size={11} strokeWidth={1.8} />
                    Hashed by <code style={{ fontFamily: "var(--font-mono)" }}>workspace.id</code> — deterministic per workspace
                  </div>
                </div>
              </div>

              <div>
                <h4
                  style={{
                    fontSize: "var(--fs-10)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--fg-subtle)",
                    fontWeight: 700,
                    margin: "0 0 var(--space-2)",
                  }}
                >
                  Targeting rules
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-1h)",
                  }}
                >
                  {(selected.rules ?? []).map((r, i) => (
                    <div
                      key={`${r.when}-${i}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto minmax(0, 1fr) auto minmax(0, 0.6fr) auto",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        padding: "var(--space-2) var(--space-2h)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--fs-10)",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--fg-subtle)",
                          fontWeight: 700,
                          width: 28,
                        }}
                      >
                        IF
                      </span>
                      <code
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: "var(--fg)",
                        }}
                      >
                        {r.when}
                      </code>
                      <span
                        style={{
                          fontSize: "var(--fs-10)",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--fg-subtle)",
                          fontWeight: 700,
                        }}
                      >
                        SERVE
                      </span>
                      <span
                        className="demo-badge demo-badge--accent"
                        style={{
                          fontFamily: "var(--font-mono)",
                          textTransform: "none",
                          letterSpacing: 0,
                        }}
                      >
                        {r.serve}
                      </span>
                      <button
                        className="demo-btn demo-btn--ghost"
                        aria-label="Remove rule"
                        style={{ padding: "2px 6px" }}
                      >
                        <Trash2 size={11} strokeWidth={1.8} />
                      </button>
                    </div>
                  ))}
                  {(selected.rules ?? []).length === 0 && (
                    <div
                      style={{
                        fontSize: "var(--fs-xs)",
                        color: "var(--fg-subtle)",
                        padding: "var(--space-2) var(--space-2h)",
                        border: "1px dashed var(--border)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      No targeting rules — rollout percent applies to everyone.
                    </div>
                  )}
                  <button
                    className="demo-btn demo-btn--ghost"
                    style={{ alignSelf: "flex-start" }}
                  >
                    <Plus size={11} strokeWidth={1.8} /> Add rule
                  </button>
                </div>
              </div>

              <div>
                <h4
                  style={{
                    fontSize: "var(--fs-10)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--fg-subtle)",
                    fontWeight: 700,
                    margin: "0 0 var(--space-2)",
                  }}
                >
                  Overrides (per-identity)
                </h4>
                {(selected.overrides ?? []).length > 0 ? (
                  <table className="demo-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Variant</th>
                        <th>Since</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.overrides!.map((o) => (
                        <tr key={o.email}>
                          <td className="is-mono">{o.email}</td>
                          <td>
                            <span
                              className="demo-badge demo-badge--accent"
                              style={{
                                fontFamily: "var(--font-mono)",
                                textTransform: "none",
                                letterSpacing: 0,
                              }}
                            >
                              {o.variant}
                            </span>
                          </td>
                          <td
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              color: "var(--fg-subtle)",
                            }}
                          >
                            {o.since}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              className="demo-btn demo-btn--ghost"
                              aria-label={`Remove override for ${o.email}`}
                              style={{ padding: "2px 6px" }}
                            >
                              <Trash2 size={11} strokeWidth={1.8} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div
                    style={{
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg-subtle)",
                      padding: "var(--space-2h)",
                      border: "1px dashed var(--border)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    No overrides. Add one to force a specific variant for a member.
                  </div>
                )}
              </div>
            </div>

            {/* -------- RIGHT: Variant perf + evals -------- */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
              <div>
                <h4
                  style={{
                    fontSize: "var(--fs-10)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--fg-subtle)",
                    fontWeight: 700,
                    margin: "0 0 var(--space-2)",
                  }}
                >
                  Variant performance
                </h4>
                {selected.variantPerf ? (
                  <table className="demo-table">
                    <thead>
                      <tr>
                        <th>Variant</th>
                        <th>Traffic</th>
                        <th>CVR</th>
                        <th>p-value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.variantPerf.map((v) => {
                        const significant = v.pValue < 0.05 && v.pValue > 0;
                        return (
                          <tr key={v.name}>
                            <td className="is-mono">{v.name}</td>
                            <td>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "minmax(0, 1fr) 36px",
                                  gap: 6,
                                  alignItems: "center",
                                }}
                              >
                                <div className="demo-progress">
                                  <div className="demo-progress__bar">
                                    <div
                                      className="demo-progress__fill"
                                      style={{ width: `${(v.traffic * 100).toFixed(0)}%` }}
                                    />
                                  </div>
                                </div>
                                <span
                                  style={{
                                    fontSize: "var(--fs-10)",
                                    fontVariantNumeric: "tabular-nums",
                                    color: "var(--fg-subtle)",
                                    textAlign: "right",
                                  }}
                                >
                                  {(v.traffic * 100).toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td
                              className="is-num"
                              style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                            >
                              {(v.cvr * 100).toFixed(1)}%
                            </td>
                            <td>
                              {v.pValue === 1 ? (
                                <span
                                  style={{
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 11,
                                    color: "var(--fg-subtle)",
                                  }}
                                >
                                  baseline
                                </span>
                              ) : (
                                <span
                                  className={
                                    significant
                                      ? "demo-badge demo-badge--success"
                                      : "demo-badge"
                                  }
                                  style={{
                                    fontFamily: "var(--font-mono)",
                                    textTransform: "none",
                                    letterSpacing: 0,
                                  }}
                                >
                                  p = {v.pValue.toFixed(3)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      padding: "var(--space-3)",
                      border: "1px dashed var(--border)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg-subtle)",
                    }}
                  >
                    <Package size={14} strokeWidth={1.8} />
                    No experiment running. Split traffic into variants to populate this.
                  </div>
                )}
              </div>

              <div>
                <h4
                  style={{
                    fontSize: "var(--fs-10)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--fg-subtle)",
                    fontWeight: 700,
                    margin: "0 0 var(--space-2)",
                  }}
                >
                  Evaluations — last 24h
                </h4>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-3)",
                    background: "var(--bg-subtle)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--fs-md)",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      214,382
                    </span>
                    <span
                      style={{
                        fontSize: "var(--fs-10)",
                        color: "var(--success)",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      +12.4% vs yesterday
                    </span>
                  </div>
                  <Sparkline
                    values={selected.evaluations ?? []}
                    width={300}
                    height={48}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "var(--fs-10)",
                      color: "var(--fg-subtle)",
                      marginTop: 4,
                    }}
                  >
                    <span>24h ago</span>
                    <span>now</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "var(--space-2h) var(--space-3)",
                  background: "var(--bg-accent-subtle)",
                  border: "1px solid var(--border-accent-subtle)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  gap: "var(--space-2h)",
                  alignItems: "flex-start",
                }}
              >
                <Flag
                  size={14}
                  strokeWidth={1.8}
                  style={{ color: "var(--accent)", marginTop: 2, flexShrink: 0 }}
                />
                <div
                  style={{
                    fontSize: "var(--fs-xs)",
                    color: "var(--fg)",
                    lineHeight: "var(--lh-relaxed)",
                  }}
                >
                  Hashed identity means every workspace sees a stable variant — bumping
                  rollout only adds new workspaces, never flips an existing one.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
