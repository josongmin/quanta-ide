import { useState } from "react";
import type { CSSProperties } from "react";
import {
  Brain,
  Sparkles,
  Globe,
  Server,
  Check,
  Shield,
  AlertTriangle,
  Zap,
  Info,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { StatCard } from "../../internal/StatCard";

type Tier = "Smart" | "Fast" | "Reasoning";

interface ModelRow {
  id: string;
  tier: Tier;
  context: string;
  priceIn: string;
  priceOut: string;
  on: boolean;
}

interface Provider {
  id: string;
  vendor: string;
  accent: string;
  icon: typeof Brain;
  modelCount: string;
  status: string;
  enabled: boolean;
  note: string;
  models: ModelRow[];
  onPrem?: boolean;
}

const PROVIDERS: Provider[] = [
  {
    id: "anthropic",
    vendor: "Anthropic",
    accent: "#d97706",
    icon: Sparkles,
    modelCount: "3 models",
    status: "HEALTHY · 120ms p50",
    enabled: true,
    note: "Data not used for training",
    models: [
      { id: "claude-opus-4.7",   tier: "Smart", context: "1M",   priceIn: "$15", priceOut: "$75", on: true },
      { id: "claude-sonnet-4.6", tier: "Fast",  context: "400k", priceIn: "$3",  priceOut: "$15", on: true },
      { id: "claude-haiku-4.5",  tier: "Fast",  context: "200k", priceIn: "$0.80", priceOut: "$4", on: true },
    ],
  },
  {
    id: "openai",
    vendor: "OpenAI",
    accent: "#10b981",
    icon: Brain,
    modelCount: "3 models",
    status: "HEALTHY · 180ms p50",
    enabled: true,
    note: "Zero-retention endpoint",
    models: [
      { id: "gpt-5",      tier: "Smart",     context: "512k", priceIn: "$12", priceOut: "$48", on: true },
      { id: "gpt-5-mini", tier: "Fast",      context: "256k", priceIn: "$2",  priceOut: "$8",  on: true },
      { id: "o4",         tier: "Reasoning", context: "128k", priceIn: "$18", priceOut: "$90", on: false },
    ],
  },
  {
    id: "google",
    vendor: "Google",
    accent: "#2563eb",
    icon: Globe,
    modelCount: "2 models",
    status: "HEALTHY · 140ms p50",
    enabled: true,
    note: "Vertex AI region locked · US",
    models: [
      { id: "gemini-2.5-pro",   tier: "Smart", context: "2M",   priceIn: "$7",    priceOut: "$21", on: true },
      { id: "gemini-2.5-flash", tier: "Fast",  context: "1M",   priceIn: "$0.40", priceOut: "$1.20", on: false },
    ],
  },
  {
    id: "local",
    vendor: "Local / Self-hosted",
    accent: "var(--fg-muted)",
    icon: Server,
    modelCount: "2 models",
    status: "READY · on-prem",
    enabled: false,
    note: "Stays inside your VPC",
    onPrem: true,
    models: [
      { id: "qwen3-coder-32b (Ollama)",        tier: "Fast",  context: "128k", priceIn: "$0",    priceOut: "$0",    on: false },
      { id: "quanta-internal-v3 (Modal)",      tier: "Smart", context: "256k", priceIn: "compute", priceOut: "compute", on: false },
    ],
  },
];

interface EngineRoute {
  engine: string;
  primary: string;
  primaryVendor: string;
  fallback: string;
  fallbackVendor: string;
  timeout: string;
}

const ENGINE_ROUTING: EngineRoute[] = [
  { engine: "risk.score",          primary: "claude-sonnet-4.6", primaryVendor: "Anthropic", fallback: "gpt-5-mini",        fallbackVendor: "OpenAI",    timeout: "8s" },
  { engine: "blast.radius",        primary: "claude-opus-4.7",   primaryVendor: "Anthropic", fallback: "gpt-5",             fallbackVendor: "OpenAI",    timeout: "20s" },
  { engine: "taint.trace",         primary: "gpt-5",             primaryVendor: "OpenAI",    fallback: "gemini-2.5-pro",    fallbackVendor: "Google",    timeout: "15s" },
  { engine: "behavior.diff",       primary: "o4",                primaryVendor: "OpenAI",    fallback: "claude-opus-4.7",   fallbackVendor: "Anthropic", timeout: "30s" },
  { engine: "incidents.correlate", primary: "gemini-2.5-pro",    primaryVendor: "Google",    fallback: "claude-sonnet-4.6", fallbackVendor: "Anthropic", timeout: "12s" },
  { engine: "ownership",           primary: "claude-haiku-4.5",  primaryVendor: "Anthropic", fallback: "gemini-2.5-flash",  fallbackVendor: "Google",    timeout: "5s" },
];

interface PolicyRow {
  id: string;
  title: string;
  desc: string;
  on: boolean;
  danger?: boolean;
  retention?: string;
}

const POLICIES: PolicyRow[] = [
  { id: "p1", title: "Do not send source code to any vendor",  desc: "Analyzes locally and ships only summarized symbols / edges.", on: true },
  { id: "p2", title: "Redact secrets before upload",           desc: "Applies AWS/GCP key patterns and OAuth token shapes.",         on: true },
  { id: "p3", title: "Allow vendor fine-tuning on our queries", desc: "If enabled, vendor may use prompts to improve their model.",   on: false, danger: true },
  { id: "p4", title: "Cache embeddings cross-workspace",       desc: "Reduces spend but leaks structural hints between tenants.",     on: false },
];

const RETENTION_OPTIONS = ["0 days (no retention)", "7 days", "30 days", "90 days", "forever"] as const;

function ProviderTile({ p }: { p: Provider }) {
  const [enabled, setEnabled] = useState(p.enabled);
  const tileStyle: CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-4)",
    background: "var(--bg)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
    opacity: enabled ? 1 : 0.72,
    transition: "opacity 0.16s ease",
  };
  const iconTileStyle: CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: "var(--radius-md)",
    background: `color-mix(in srgb, ${p.accent} 14%, var(--bg))`,
    color: p.accent,
    border: `1px solid color-mix(in srgb, ${p.accent} 32%, var(--border))`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  };
  const Icon = p.icon;
  return (
    <article style={tileStyle}>
      <header style={{ display: "flex", alignItems: "center", gap: "var(--space-2h)" }}>
        <span aria-hidden="true" style={iconTileStyle}>
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1h)" }}>
            <div style={{ fontSize: "var(--fs-md)", fontWeight: 600 }}>{p.vendor}</div>
            {p.onPrem && <span className="demo-badge">On-prem</span>}
          </div>
          <div
            style={{
              fontSize: "var(--fs-10)",
              color: "var(--fg-subtle)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: "var(--fw-semibold)",
              marginTop: 2,
            }}
          >
            {p.modelCount} · {p.status}
          </div>
        </div>
        <label className="demo-toggle" aria-label={`${enabled ? "Disable" : "Enable"} ${p.vendor}`}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="demo-toggle__track" />
        </label>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1h)" }}>
        {p.models.map((m) => (
          <ModelRowTile key={m.id} m={m} disabled={!enabled} />
        ))}
      </div>

      <footer
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2h)",
          paddingTop: "var(--space-2)",
          borderTop: "1px dashed var(--border)",
          fontSize: "var(--fs-10)",
          color: "var(--fg-subtle)",
          letterSpacing: "0.04em",
        }}
      >
        <Check size={11} strokeWidth={2.2} aria-hidden="true" style={{ color: "var(--success)" }} />
        <span>{p.note}</span>
        <span style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className="demo-btn demo-btn--ghost"
            style={{ height: 24, padding: "0 var(--space-2)", fontSize: "var(--fs-10)" }}
          >
            Provider settings
          </button>
        </span>
      </footer>
    </article>
  );
}

function ModelRowTile({ m, disabled }: { m: ModelRow; disabled: boolean }) {
  const [on, setOn] = useState(m.on);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto auto",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-1h) var(--space-2h)",
        background: "var(--bg-subtle)",
        borderRadius: "var(--radius-sm)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--fs-xs)",
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            color: "var(--fg)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {m.id}
        </div>
        <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", marginTop: 1 }}>
          {m.context} ctx · {m.priceIn}/1M in · {m.priceOut}/1M out
        </div>
      </div>
      <span className="demo-badge">{m.tier}</span>
      <label className="demo-toggle" aria-label={`${on ? "Disable" : "Enable"} ${m.id}`}>
        <input
          type="checkbox"
          checked={on}
          disabled={disabled}
          onChange={(e) => setOn(e.target.checked)}
        />
        <span className="demo-toggle__track" />
      </label>
    </div>
  );
}

function VendorChip({ model, vendor }: { model: string; vendor: string }) {
  const accent =
    vendor === "Anthropic" ? "#d97706"
    : vendor === "OpenAI"  ? "#10b981"
    : vendor === "Google"  ? "#2563eb"
    :                         "var(--fg-muted)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-xs)",
        fontWeight: "var(--fw-medium)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: accent,
          flex: "0 0 auto",
        }}
      />
      {model}
    </span>
  );
}

function PolicyToggleRow({ p }: { p: PolicyRow }) {
  const [on, setOn] = useState(p.on);
  const [retention, setRetention] = useState<string>(RETENTION_OPTIONS[2]);
  const danger = !!(p.danger && on);
  return (
    <div
      className="demo-row"
      style={{
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        background: danger ? "var(--bg-danger-subtle)" : undefined,
      }}
    >
      <span
        className={danger ? "demo-dot demo-dot--danger" : on ? "demo-dot demo-dot--success" : "demo-dot"}
      />
      <div className="demo-row__primary">
        <div className="demo-row__title" style={{ color: danger ? "var(--danger)" : undefined }}>
          {p.title}
        </div>
        <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", marginTop: 2 }}>
          {p.desc}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        {p.retention && (
          <select
            className="demo-select"
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
            aria-label="Retention"
            style={{ height: 26, padding: "0 var(--space-2)", fontSize: "var(--fs-xs)" }}
          >
            {RETENTION_OPTIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        )}
        <label className="demo-toggle" aria-label={p.title}>
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
          />
          <span className="demo-toggle__track" />
        </label>
      </div>
    </div>
  );
}

export function ModelPreferencesPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="AI"
        title="Model preferences"
        sub="Pick which foundation models power each Quanta engine. Control data-sharing, fine-tuning, and fallbacks."
      />
      <div className="demo-app__body">
        {/* Stats row */}
        <div className="demo-grid-3" style={{ marginBottom: "var(--space-4)" }}>
          <StatCard
            label="Active models"
            value="5 / 12"
            icon={<Brain size={12} strokeWidth={1.8} />}
            delta="3 providers enabled"
            deltaTone="neutral"
          />
          <StatCard
            label="Primary vendor"
            value="Anthropic"
            icon={<Sparkles size={12} strokeWidth={1.8} />}
            delta="63% of traffic this week"
            deltaTone="neutral"
          />
          <StatCard
            label="Mean request"
            value="1.2k tokens"
            icon={<Zap size={12} strokeWidth={1.8} />}
            delta="-4% vs last period"
            deltaTone="up"
          />
        </div>

        {/* Provider grid */}
        <div className="demo-sectionbar">
          <span className="demo-sectionbar__title">Providers</span>
          <span className="demo-sectionbar__desc">Toggle whole vendors or individual models</span>
          <span className="demo-sectionbar__spacer" />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
              fontSize: "var(--fs-10)",
              color: "var(--fg-subtle)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: "var(--fw-semibold)",
            }}
          >
            <Shield size={11} strokeWidth={2} aria-hidden="true" />
            SOC 2 Type II · HIPAA BAA
          </span>
        </div>
        <div className="demo-grid-2" style={{ marginBottom: "var(--space-5)" }}>
          {PROVIDERS.map((p) => (
            <ProviderTile key={p.id} p={p} />
          ))}
        </div>

        {/* Routing */}
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Engine → model routing</div>
              <div className="demo-block__sub">
                Choose which model handles each engine. Fallbacks kick in on timeout or 429.
              </div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button type="button" className="demo-btn demo-btn--ghost">
              Reset to defaults
            </button>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Engine</th>
                  <th>Primary</th>
                  <th>Fallback</th>
                  <th style={{ textAlign: "right" }}>Timeout</th>
                </tr>
              </thead>
              <tbody>
                {ENGINE_ROUTING.map((r) => (
                  <tr key={r.engine}>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--fs-xs)",
                          fontWeight: "var(--fw-semibold)",
                          color: "var(--fg)",
                        }}
                      >
                        {r.engine}
                      </span>
                    </td>
                    <td>
                      <VendorChip model={r.primary} vendor={r.primaryVendor} />
                    </td>
                    <td>
                      <VendorChip model={r.fallback} vendor={r.fallbackVendor} />
                    </td>
                    <td
                      className="is-num"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--fs-xs)",
                        color: "var(--fg-muted)",
                      }}
                    >
                      {r.timeout}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Data handling policies */}
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Data handling</div>
              <div className="demo-block__sub">
                Applies to every outbound call. Policy changes audit to{" "}
                <span style={{ fontFamily: "var(--font-mono)" }}>admin.audit_log</span>.
              </div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1)",
                fontSize: "var(--fs-10)",
                color: "var(--fg-subtle)",
              }}
            >
              <Info size={11} strokeWidth={2} aria-hidden="true" /> Applied workspace-wide
            </span>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            {POLICIES.map((p) => (
              <PolicyToggleRow key={p.id} p={p} />
            ))}
            <PolicyToggleRow
              p={{
                id: "p5",
                title: "Retain conversation history in agent vendor",
                desc: "Kept for debugging and quality review. Shorter is safer.",
                on: true,
                retention: "30d",
              }}
            />
          </div>
        </div>

        {/* Danger callout */}
        <div
          style={{
            marginTop: "var(--space-5)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--bg-warn-subtle)",
            border: "1px dashed var(--border-warn-subtle)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-2h)",
            fontSize: "var(--fs-xs)",
            color: "var(--fg)",
            lineHeight: "var(--lh-relaxed)",
          }}
        >
          <AlertTriangle
            size={14}
            strokeWidth={1.8}
            aria-hidden="true"
            style={{ color: "var(--warn)", flex: "0 0 auto", marginTop: 2 }}
          />
          <div>
            <strong>Disabling Anthropic will re-route 63% of traffic.</strong> Expect a ~180ms median
            latency increase and a short warm-up while fallbacks take over. We recommend staging this
            change during off-peak hours.
          </div>
        </div>
      </div>
    </div>
  );
}
