import { useState } from "react";
import {
  Sparkles,
  Bot,
  Cpu,
  ChevronRight,
  Download,
  FileDown,
  Search,
  Clock,
  ShieldCheck,
  Fingerprint,
  AlertTriangle,
  Check,
  ScrollText,
  Zap,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { StatCard } from "../../internal/StatCard";
import { Sparkline } from "../../internal/Sparkline";
import { DarkPanel, DarkPanelHeader, DarkPanelBody } from "../../internal/DarkPanel";
import { CopyButton } from "../../internal/CopyButton";
import { HttpStatusBadge } from "../../internal/HttpStatusBadge";
import { VENDOR_ACCENTS, type VendorId } from "./vendor-colors";

type Trigger = "Manual" | "Webhook" | "CI" | "Scheduled";
type Status = "success" | "warn" | "error";

interface Entry {
  id: string;
  when: string;
  summary: string;
  vendor: VendorId;
  vendorLabel: string;
  model: string;
  tokens: string;
  ms: number;
  status: Status;
  actor: string;
  trigger: Trigger;
  workspace: string;
  cost: string;
  files: string[];
  prompt: string;
  promptFull: string;
  response: string;
  httpCode?: number;
  note?: string;
}

const ENTRIES: Entry[] = [
  {
    id: "e1",
    when: "14:28:12",
    summary: "Review PR #482 for safety",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-opus-4.7",
    tokens: "4.2k",
    ms: 4180,
    status: "success",
    actor: "ada@acme.com",
    trigger: "Webhook",
    workspace: "acme/checkout",
    cost: "$0.063",
    files: [
      "services/orders/checkout.py",
      "services/orders/idempotency.py",
      "policies/auth.quanta",
    ],
    prompt:
      "You are reviewing a pull request for safety issues.\n\nFile: services/orders/checkout.py\nDiff:\n@@ -41,7 +41,9 @@\n- if user.is_admin:\n-     bypass_limits()\n+ if user.email.endswith('@acme.com'):\n+     bypass_limits()\n+     log.info('bypass granted')",
    promptFull:
      "You are reviewing a pull request for safety issues.\n\nFile: services/orders/checkout.py\nDiff:\n@@ -41,7 +41,9 @@\n- if user.is_admin:\n-     bypass_limits()\n+ if user.email.endswith('@acme.com'):\n+     bypass_limits()\n+     log.info('bypass granted')\n\nActive policies:\n- auth.no-email-domain-trust\n- auth.admin-only-bypass\n- audit.log-bypass-attempts\n\nRespond with 0-5 findings, each as:\n- severity: low|med|high\n- rule: <policy id>\n- line: <line number>\n- message: <one-sentence explanation>\n- suggestion: <optional patch>\n\nOnly return findings that a senior reviewer would call out.\n\n[SECRETS REDACTED] [PII REDACTED]",
    response:
      "- severity: high\n  rule: auth.no-email-domain-trust\n  line: 42\n  message: Email-domain check replaces explicit admin check. Any acme.com inbox now bypasses limits.\n  suggestion: Restore is_admin OR add a role check — domains are spoofable via SSO misconfig.",
  },
  {
    id: "e2",
    when: "14:27:51",
    summary: "Generate policy from example",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-sonnet-4.6",
    tokens: "1.8k",
    ms: 1420,
    status: "success",
    actor: "grace@acme.com",
    trigger: "Manual",
    workspace: "acme/billing",
    cost: "$0.011",
    files: ["policies/billing.quanta"],
    prompt: "Write a Quanta policy for: Don't let PRs merge if they touch billing/* without @billing-owners review.",
    promptFull: "Write a Quanta policy for:\n\nDon't let PRs merge if they touch billing/* without @billing-owners review.\n\nApplies to: billing/\nRelated: workspace.default",
    response: "rule 'billing-needs-owners':\n  when path('billing/**')\n  require review_from('@billing-owners')\n  otherwise block('Billing changes need owner review.')",
  },
  {
    id: "e3",
    when: "14:24:02",
    summary: "Explain taxes.py::compute_breakdown",
    vendor: "openai",
    vendorLabel: "OpenAI",
    model: "gpt-5",
    tokens: "2.1k",
    ms: 2300,
    status: "success",
    actor: "alan@acme.com",
    trigger: "Manual",
    workspace: "acme/checkout",
    cost: "$0.026",
    files: ["services/orders/taxes.py"],
    prompt: "Explain services/orders/taxes.py::compute_breakdown in one paragraph.",
    promptFull: "Explain services/orders/taxes.py::compute_breakdown in one paragraph.\n\n[function body + 20 lines of context attached]\n\nPolicies: docs.default",
    response: "compute_breakdown splits an order's line items by taxable jurisdiction. It's called from checkout.py on submit and from the nightly reconciler to true up last-day orders.",
  },
  {
    id: "e4",
    when: "14:18:11",
    summary: "Find similar code patterns",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-haiku-4.5",
    tokens: "600",
    ms: 520,
    status: "success",
    actor: "dan@acme.com",
    trigger: "Manual",
    workspace: "acme/platform",
    cost: "$0.001",
    files: ["net/http_client.py", "queue/worker.py", "billing/webhooks.py"],
    prompt: "Find code similar to: retry loop with backoff.",
    promptFull: "Find code similar to:\n\n  for attempt in range(6):\n      try: do()\n      except: sleep(2 ** attempt)\n\nScope: workspace",
    response: "12 matches across 9 files. Strongest: net/http_client.py:84, queue/worker.py:210, billing/webhooks.py:312.",
  },
  {
    id: "e5",
    when: "14:11:35",
    summary: "Suggest refactor for order_service",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-opus-4.7",
    tokens: "8.4k",
    ms: 7120,
    status: "success",
    actor: "ada@acme.com",
    trigger: "CI",
    workspace: "acme/orders",
    cost: "$0.126",
    files: ["services/orders/order_service.py", "services/orders/repo.py"],
    prompt: "Suggest ONE refactor for services/orders/order_service.py.",
    promptFull: "Suggest ONE refactor for services/orders/order_service.py.\n\n[file body attached]\n\nPolicies: refactor.default",
    response: "Extract _finalize_order into a PaymentFinalizer class. Cost: low. Risk: low. Diff: 42 lines.",
  },
  {
    id: "e6",
    when: "13:58:09",
    summary: "Triage incident INC-0042",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-opus-4.7",
    tokens: "5.1k",
    ms: 4820,
    status: "success",
    actor: "alan@acme.com",
    trigger: "Manual",
    workspace: "acme/incidents",
    cost: "$0.077",
    files: [
      "services/orders/checkout.py",
      "queue/dispatcher.py",
      "ops/monitoring/alerts.yaml",
    ],
    prompt: "Root-cause INC-0042 (checkout 5xx spike).",
    promptFull: "Root-cause INC-0042 (checkout 5xx spike).\n\nStack trace: TypeError at checkout.py:118.\n\nRecent commits: c9a21f3b, 8d4e0a2.\n\nPolicies: incidents.default",
    response: "Likely: fetch_plan() returned None after c9a21f3b (removed the default_plan fallback). Checkout.py:118 unpacks assuming non-None. Quoted in the postmortem.",
    note: "Quoted in the incident postmortem",
  },
  {
    id: "e7",
    when: "13:42:22",
    summary: "Migration plan: v1 → v2 API",
    vendor: "openai",
    vendorLabel: "OpenAI",
    model: "gpt-5",
    tokens: "6.2k",
    ms: 5640,
    status: "success",
    actor: "grace@acme.com",
    trigger: "Manual",
    workspace: "acme/orders",
    cost: "$0.074",
    files: ["services/orders/v1.py", "services/orders/v2.py"],
    prompt: "Plan migration from v1 orders API to v2.",
    promptFull: "Plan migration from v1 orders API to v2.\n\nTarget: new pricing fields + idempotency keys.\n\nPolicies: release.default",
    response: "Phase 1: ship /v2 alongside /v1 behind flag. Phase 2: dual-write with reconciliation. Phase 3: cutover with rollback gate.",
  },
  {
    id: "e8",
    when: "13:21:55",
    summary: "Generate tests for policy evaluator",
    vendor: "google",
    vendorLabel: "Google",
    model: "gemini-2.5-pro",
    tokens: "3.8k",
    ms: 2910,
    status: "success",
    actor: "ada@acme.com",
    trigger: "CI",
    workspace: "acme/policy",
    cost: "$0.027",
    files: ["services/policy/evaluator.py", "tests/policy/test_evaluator.py"],
    prompt: "Write tests for services/policy/evaluator.py::evaluate.",
    promptFull: "Write tests for services/policy/evaluator.py::evaluate using pytest fixtures from the neighbor file.\n\nPolicies: tests.default",
    response: "Produced 14 tests covering: owner allow, non-owner deny, unknown policy, empty req, multi-rule short-circuit.",
  },
  {
    id: "e9",
    when: "13:05:11",
    summary: "Why did webhook delivery fail?",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-sonnet-4.6",
    tokens: "1.1k",
    ms: 900,
    status: "warn",
    actor: "dan@acme.com",
    trigger: "Webhook",
    workspace: "acme/platform",
    cost: "$0.007",
    httpCode: 429,
    files: ["services/webhooks/dispatcher.py"],
    prompt: "Why did webhook delivery to hooks.acme.com/ci fail?",
    promptFull: "Why did webhook delivery to hooks.acme.com/ci fail?\n\n[delivery logs attached]\n\nPolicies: incidents.default",
    response: "Vendor returned 429 rate-limited. Retrying with exponential backoff in 30s. Upstream quota rotates hourly.",
    note: "Retried successfully at 13:05:45",
  },
  {
    id: "e10",
    when: "12:58:01",
    summary: "Ask-the-codebase: where is the retry logic?",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-opus-4.7",
    tokens: "4.0k",
    ms: 3680,
    status: "success",
    actor: "alan@acme.com",
    trigger: "Manual",
    workspace: "acme/platform",
    cost: "$0.060",
    files: ["net/http_client.py", "queue/worker.py", "billing/webhooks.py"],
    prompt: "Where is the retry logic in this codebase?",
    promptFull: "Where is the retry logic in this codebase?\n\nScope: workspace\nPolicies: —",
    response: "Three implementations: net/http_client.py (tenacity, used by most services), queue/worker.py (custom backoff for Kafka), billing/webhooks.py (fixed-interval).",
  },
];

const DATE_RANGES = ["Last 24h", "Last 7d", "Last 30d", "Custom"] as const;
const MODEL_FILTERS = [
  "Any model",
  "claude-opus-4.7",
  "claude-sonnet-4.6",
  "claude-haiku-4.5",
  "gpt-5",
  "gemini-2.5-pro",
  "local",
] as const;
const ACTOR_FILTERS = [
  "Any actor",
  "ada@acme.com",
  "alan@acme.com",
  "grace@acme.com",
  "dan@acme.com",
] as const;
const TRIGGER_FILTERS = ["Any trigger", "Manual", "Webhook", "CI", "Scheduled"] as const;

const TOKENS_TREND = [
  0.3, 0.28, 0.32, 0.38, 0.35, 0.4, 0.45, 0.42, 0.5, 0.54, 0.5, 0.58,
  0.6, 0.56, 0.62, 0.66, 0.7, 0.68, 0.72, 0.76, 0.8, 0.82, 0.78, 0.84,
  0.88, 0.86, 0.9, 0.94, 0.9, 0.96,
];

function ModelPill({ vendor, model }: { vendor: VendorId; model: string }) {
  const accent = VENDOR_ACCENTS[vendor];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "2px var(--space-1h)",
        background: accent.bg,
        border: `1px solid color-mix(in srgb, ${accent.fg} 32%, var(--border))`,
        borderRadius: "var(--radius-xs)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-10)",
        fontWeight: 600,
        color: "var(--fg)",
        whiteSpace: "nowrap",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: accent.fg,
          flex: "0 0 auto",
        }}
      />
      {model}
    </span>
  );
}

function StatusBadge({ e }: { e: Entry }) {
  if (e.status === "warn" && e.httpCode) return <HttpStatusBadge code={e.httpCode} />;
  if (e.status === "success")
    return (
      <span
        className="demo-badge demo-badge--success"
        style={{ display: "inline-flex", alignItems: "center", gap: 3 }}
      >
        <Check size={10} strokeWidth={2.4} /> ok
      </span>
    );
  if (e.status === "warn")
    return (
      <span className="demo-badge demo-badge--warn">
        <AlertTriangle size={10} strokeWidth={2} /> warn
      </span>
    );
  return <span className="demo-badge demo-badge--danger">err</span>;
}

export function AiAuditLogPage() {
  const [expandedId, setExpandedId] = useState<string>(ENTRIES[0]!.id);
  const [range, setRange] = useState<(typeof DATE_RANGES)[number]>("Last 24h");
  const [model, setModel] = useState<(typeof MODEL_FILTERS)[number]>("Any model");
  const [actor, setActor] = useState<(typeof ACTOR_FILTERS)[number]>("Any actor");
  const [trigger, setTrigger] = useState<(typeof TRIGGER_FILTERS)[number]>("Any trigger");
  const [query, setQuery] = useState("");
  const [showFullPrompt, setShowFullPrompt] = useState<Record<string, boolean>>({});

  const filtered = ENTRIES.filter((e) => {
    if (model !== "Any model" && e.model !== model) return false;
    if (actor !== "Any actor" && e.actor !== actor) return false;
    if (trigger !== "Any trigger" && e.trigger !== trigger) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (
        !e.summary.toLowerCase().includes(q) &&
        !e.model.toLowerCase().includes(q) &&
        !e.actor.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="AI"
        title="AI audit log"
        sub="Every prompt the agent sent, every file it read, every model that responded. Retained 90 days on Team, 7 years on Enterprise."
      />
      <div className="demo-app__body">
        {/* Stats row */}
        <div className="demo-grid-3" style={{ marginBottom: "var(--space-4)" }}>
          <StatCard
            label="Agent runs (24h)"
            value="142"
            icon={<Bot size={12} strokeWidth={1.8} />}
            delta="12% vs yesterday"
            deltaTone="up"
          />
          <StatCard
            label="Tokens used"
            value="1.2M"
            icon={<Sparkles size={12} strokeWidth={1.8} />}
            delta="Within 42% of monthly cap"
            deltaTone="neutral"
            chart={<Sparkline values={TOKENS_TREND} width={260} height={36} color="var(--fg)" strokeWidth={1.4} />}
          />
          <StatCard
            label="Files touched"
            value="2,418"
            icon={<ScrollText size={12} strokeWidth={1.8} />}
            delta="412 unique files"
            deltaTone="neutral"
          />
          <StatCard
            label="Avg latency"
            value="4.2s"
            icon={<Zap size={12} strokeWidth={1.8} />}
            delta="-180ms vs last week"
            deltaTone="up"
          />
        </div>

        {/* Filter bar */}
        <div className="demo-sectionbar" style={{ flexWrap: "wrap", gap: "var(--space-2)" }}>
          <select
            className="demo-select"
            style={{ width: 120 }}
            value={range}
            onChange={(e) => setRange(e.target.value as (typeof DATE_RANGES)[number])}
            aria-label="Date range"
          >
            {DATE_RANGES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            className="demo-select"
            style={{ width: 160 }}
            value={model}
            onChange={(e) => setModel(e.target.value as (typeof MODEL_FILTERS)[number])}
            aria-label="Model filter"
          >
            {MODEL_FILTERS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select
            className="demo-select"
            style={{ width: 150 }}
            value={actor}
            onChange={(e) => setActor(e.target.value as (typeof ACTOR_FILTERS)[number])}
            aria-label="Actor filter"
          >
            {ACTOR_FILTERS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select
            className="demo-select"
            style={{ width: 130 }}
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as (typeof TRIGGER_FILTERS)[number])}
            aria-label="Trigger filter"
          >
            {TRIGGER_FILTERS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 280 }}>
            <Search
              size={12}
              strokeWidth={1.8}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--fg-subtle)",
              }}
            />
            <input
              className="demo-input"
              placeholder="Search prompt, model, actor…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 28 }}
            />
          </div>
          <span className="demo-sectionbar__spacer" />
          <button type="button" className="demo-btn demo-btn--ghost">
            <FileDown size={13} strokeWidth={1.8} /> Export JSONL
          </button>
        </div>

        {/* Main log */}
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Agent activity</div>
              <div className="demo-block__sub">
                {filtered.length} of {ENTRIES.length} entries · Newest first
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
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={11} strokeWidth={2} /> Guardrails on
            </span>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            {filtered.map((e) => {
              const isOpen = expandedId === e.id;
              return (
                <div key={e.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? "" : e.id)}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns:
                        "auto 80px minmax(0, 1fr) 180px 64px 72px auto",
                      gap: "var(--space-3)",
                      alignItems: "center",
                      padding: "var(--space-2h) var(--space-4)",
                      borderBottom: "1px solid var(--border)",
                      background: isOpen ? "var(--bg-subtle)" : "var(--bg)",
                      textAlign: "left",
                      cursor: "pointer",
                      border: "none",
                      borderTop: "none",
                      borderLeft: 0,
                      borderRight: 0,
                    }}
                  >
                    <ChevronRight
                      size={13}
                      strokeWidth={1.8}
                      style={{
                        transform: isOpen ? "rotate(90deg)" : "none",
                        transition: "transform 0.12s",
                        color: "var(--fg-subtle)",
                      }}
                    />
                    <span
                      className="is-mono"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--fg-muted)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {e.when}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--fs-sm)",
                        color: "var(--fg)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.summary}
                    </span>
                    <ModelPill vendor={e.vendor} model={e.model} />
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--fs-xs)",
                        color: "var(--fg-muted)",
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                      }}
                    >
                      {e.tokens}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--fs-xs)",
                        color: "var(--fg-muted)",
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                      }}
                    >
                      {e.ms}ms
                    </span>
                    <StatusBadge e={e} />
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        padding: "var(--space-4)",
                        background: "var(--bg-subtle)",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-3)",
                      }}
                    >
                      {/* 4-col mini-grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                          gap: "var(--space-2) var(--space-4)",
                          padding: "var(--space-2h) var(--space-3)",
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "var(--fs-10)",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              color: "var(--fg-subtle)",
                              fontWeight: 600,
                              marginBottom: 2,
                            }}
                          >
                            Actor
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "var(--fs-xs)",
                              color: "var(--fg)",
                            }}
                          >
                            {e.actor}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "var(--fs-10)",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              color: "var(--fg-subtle)",
                              fontWeight: 600,
                              marginBottom: 2,
                            }}
                          >
                            Trigger
                          </div>
                          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg)" }}>
                            {e.trigger}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "var(--fs-10)",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              color: "var(--fg-subtle)",
                              fontWeight: 600,
                              marginBottom: 2,
                            }}
                          >
                            Workspace
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "var(--fs-xs)",
                              color: "var(--fg)",
                            }}
                          >
                            {e.workspace}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "var(--fs-10)",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              color: "var(--fg-subtle)",
                              fontWeight: 600,
                              marginBottom: 2,
                            }}
                          >
                            Cost
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "var(--fs-xs)",
                              color: "var(--fg)",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {e.cost}
                          </div>
                        </div>
                      </div>

                      {/* Files accessed */}
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-1h)",
                            fontSize: "var(--fs-10)",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: "var(--fg-subtle)",
                            fontWeight: 600,
                            marginBottom: "var(--space-1h)",
                          }}
                        >
                          <ScrollText size={11} strokeWidth={1.8} /> Files accessed ({e.files.length})
                        </div>
                        <ul
                          style={{
                            listStyle: "none",
                            margin: 0,
                            padding: 0,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "var(--space-1h)",
                          }}
                        >
                          {e.files.map((f) => (
                            <li
                              key={f}
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "var(--fs-10)",
                                padding: "2px var(--space-1h)",
                                background: "var(--bg)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-xs)",
                                color: "var(--fg-muted)",
                              }}
                            >
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Prompt + Response */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                          gap: "var(--space-3)",
                        }}
                      >
                        <DarkPanel padding="0" borderRadius="var(--radius-md)">
                          <DarkPanelHeader
                            right={<CopyButton value={showFullPrompt[e.id] ? e.promptFull : e.prompt} variant="soft" size="sm" />}
                          >
                            <span style={{ color: "#9ca3af", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              Prompt
                            </span>
                            <span style={{ color: "#6b7280", fontSize: 10 }}>
                              {showFullPrompt[e.id] ? "full" : "preview"}
                            </span>
                          </DarkPanelHeader>
                          <DarkPanelBody padding="var(--space-3) var(--space-4)">
                            <pre
                              style={{
                                margin: 0,
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                                color: "#d1d5db",
                                lineHeight: 1.6,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {showFullPrompt[e.id] ? e.promptFull : e.prompt}
                            </pre>
                            <button
                              type="button"
                              onClick={() =>
                                setShowFullPrompt((s) => ({ ...s, [e.id]: !s[e.id] }))
                              }
                              style={{
                                marginTop: "var(--space-2)",
                                background: "transparent",
                                border: "1px solid #1f1f1f",
                                color: "#9ca3af",
                                padding: "3px var(--space-2)",
                                borderRadius: "var(--radius-xs)",
                                fontSize: 10,
                                fontFamily: "var(--font-mono)",
                                cursor: "pointer",
                              }}
                            >
                              {showFullPrompt[e.id] ? "Show preview" : "Show full prompt (redacted)"}
                            </button>
                          </DarkPanelBody>
                        </DarkPanel>
                        <DarkPanel padding="0" borderRadius="var(--radius-md)">
                          <DarkPanelHeader
                            right={<CopyButton value={e.response} variant="soft" size="sm" />}
                          >
                            <span style={{ color: "#9ca3af", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              Response
                            </span>
                            <ModelPill vendor={e.vendor} model={e.model} />
                          </DarkPanelHeader>
                          <DarkPanelBody padding="var(--space-3) var(--space-4)">
                            <pre
                              style={{
                                margin: 0,
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                                color: "#e4e4e4",
                                lineHeight: 1.6,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {e.response}
                            </pre>
                          </DarkPanelBody>
                        </DarkPanel>
                      </div>

                      {/* Guardrails row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-3)",
                          flexWrap: "wrap",
                          padding: "var(--space-2) var(--space-3)",
                          background: "var(--bg-success-subtle)",
                          border: "1px solid var(--border-success-subtle)",
                          borderRadius: "var(--radius-md)",
                          fontSize: "var(--fs-xs)",
                          color: "var(--fg)",
                        }}
                      >
                        <Fingerprint size={12} strokeWidth={1.8} style={{ color: "var(--success)" }} />
                        <span>
                          <Check size={10} strokeWidth={2.4} style={{ color: "var(--success)", marginRight: 2 }} />
                          Secrets redacted
                        </span>
                        <span>·</span>
                        <span>
                          <Check size={10} strokeWidth={2.4} style={{ color: "var(--success)", marginRight: 2 }} />
                          PII redacted
                        </span>
                        <span>·</span>
                        <span>
                          <Check size={10} strokeWidth={2.4} style={{ color: "var(--success)", marginRight: 2 }} />
                          Output content-filtered
                        </span>
                        {e.note && (
                          <>
                            <span style={{ marginLeft: "auto" }} />
                            <span style={{ color: "var(--fg-muted)", fontStyle: "italic" }}>
                              {e.note}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="demo-empty" style={{ padding: "var(--space-6)" }}>
                <ScrollText size={22} strokeWidth={1.6} aria-hidden="true" />
                <div className="demo-empty__title">No entries match</div>
                <div className="demo-empty__hint">Adjust filters or broaden your date range.</div>
              </div>
            )}
          </div>
        </div>

        {/* Export & compliance */}
        <div className="demo-block" style={{ marginTop: "var(--space-4)" }}>
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Export & compliance</div>
              <div className="demo-block__sub">
                Download the full audit stream for SIEM ingest or compliance review.
              </div>
            </div>
          </header>
          <div className="demo-block__body">
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button type="button" className="demo-btn demo-btn--primary">
                <Download size={13} strokeWidth={1.8} /> Export JSONL (last 24h)
              </button>
              <button type="button" className="demo-btn demo-btn--ghost">
                <FileDown size={13} strokeWidth={1.8} /> Export CSV (last 30d)
              </button>
              <button type="button" className="demo-btn demo-btn--ghost">
                <Cpu size={13} strokeWidth={1.8} /> Stream to SIEM
              </button>
              <span className="demo-sectionbar__spacer" />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1h)",
                  fontSize: "var(--fs-xs)",
                  color: "var(--fg-subtle)",
                }}
              >
                <Clock size={12} strokeWidth={1.8} />
                90d retention · Upgrade to Enterprise for 7 years
              </span>
            </div>
            <div
              style={{
                marginTop: "var(--space-3)",
                padding: "var(--space-2h) var(--space-3)",
                background: "var(--bg-accent-subtle)",
                border: "1px solid var(--border-accent-subtle)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--fs-xs)",
                color: "var(--fg)",
                lineHeight: "var(--lh-relaxed)",
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-2)",
              }}
            >
              <ShieldCheck
                size={14}
                strokeWidth={1.8}
                style={{ color: "var(--accent)", flex: "0 0 auto", marginTop: 2 }}
              />
              <div>
                Exports are signed with your workspace's audit key. Each entry includes prompt hash,
                vendor, latency, and redaction hits so downstream tooling can prove an un-tampered
                chain of custody.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
