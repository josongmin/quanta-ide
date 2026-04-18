import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Sparkles,
  Star,
  GitFork,
  MessageSquare,
  Bot,
  Plus,
  Search,
  ScrollText,
  Clock,
  ChevronRight,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { Avatars } from "../../internal/Avatars";
import { CopyButton } from "../../internal/CopyButton";
import { Sparkline } from "../../internal/Sparkline";
import { DarkPanel, DarkPanelHeader, DarkPanelBody } from "../../internal/DarkPanel";
import { useDemoNav } from "../../DemoPage";
import { VENDOR_ACCENTS, vendorFg, type VendorId } from "./vendor-colors";

type Category =
  | "Code review"
  | "Refactor"
  | "Document"
  | "Explain"
  | "Generate"
  | "Ask-the-code";

const CATEGORY_COLORS: Record<Category, string> = {
  "Code review": "var(--accent)",
  Refactor: "#8b5cf6",
  Document: "#0891b2",
  Explain: "#059669",
  Generate: "#d97706",
  "Ask-the-code": "#db2777",
};

interface PromptVariable {
  name: string;
  type: string;
  desc: string;
  default: string;
}

interface ChangelogEntry {
  version: string;
  date: string;
  note: string;
}

interface Prompt {
  id: string;
  name: string;
  category: Category;
  blurb: string;
  stars: number;
  usage: string;
  maintainers: string[];
  description: string;
  vendor: VendorId;
  vendorLabel: string;
  model: string;
  template: string;
  variables: PromptVariable[];
  exampleIn: string;
  exampleOut: string;
  uses30d: number[];
  changelog: ChangelogEntry[];
}

const PROMPTS: Prompt[] = [
  {
    id: "review-pr-for-safety",
    name: "review-pr-for-safety",
    category: "Code review",
    blurb: "Scans diffs for policy breaks, auth holes, and blast-radius surprises.",
    stars: 148,
    usage: "2.4k",
    maintainers: ["Ada Lovelace", "Grace Hopper"],
    description:
      "Runs on every PR. Cross-references the diff against your policy list, flags risky changes (auth, ACLs, migrations, secrets), and links each finding back to a policy rule or call-graph edge. Optimized for short, actionable comments rather than walls of text.",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-opus-4.7",
    template: `You are reviewing a pull request for safety issues.

File: {{file_path}}

Diff:
{{diff}}

Active policies:
{{policy_list}}

Respond with 0-5 findings, each as:
- severity: low|med|high
- rule: <policy id>
- line: <line number>
- message: <one-sentence explanation>
- suggestion: <optional patch>

Only return findings that a senior reviewer would call out.`,
    variables: [
      { name: "file_path", type: "string", desc: "Absolute path of the changed file.", default: "—" },
      { name: "diff", type: "unified_diff", desc: "Unified diff for the file, max 400 lines.", default: "(from PR)" },
      { name: "policy_list", type: "policy[]", desc: "Active policies attached to the service.", default: "workspace.default" },
    ],
    exampleIn:
      "file: services/orders/checkout.py\n@@ -41,7 +41,9 @@\n-  if user.is_admin:\n-      bypass_limits()\n+  if user.email.endswith('@acme.com'):\n+      bypass_limits()  # trust domain\n+      log.info('bypass granted')",
    exampleOut:
      "- severity: high\n  rule: auth.no-email-domain-trust\n  line: 42\n  message: Email-domain check replaces an explicit admin check. Any acme.com inbox now bypasses limits.\n  suggestion: Restore is_admin OR add a role check; domains are spoofable via SSO misconfig.",
    uses30d: [
      0.32, 0.48, 0.41, 0.55, 0.6, 0.52, 0.58, 0.7, 0.64, 0.72, 0.78, 0.7, 0.75, 0.82, 0.88, 0.8,
      0.84, 0.9, 0.86, 0.92, 0.88, 0.94, 0.9, 0.95, 0.88, 0.92, 0.96, 0.9, 0.94, 0.98,
    ],
    changelog: [
      { version: "v3.4", date: "2026-04-14", note: "Added blast-radius hints when a policy rule is missing." },
      { version: "v3.3", date: "2026-03-28", note: "Trim diff to 400 lines; skip generated files." },
      { version: "v3.2", date: "2026-03-09", note: "Switched default to claude-opus-4.7 for multi-file diffs." },
    ],
  },
  {
    id: "suggest-refactor",
    name: "suggest-refactor",
    category: "Refactor",
    blurb: "Proposes small refactors with a before/after diff, cost, and risk.",
    stars: 96,
    usage: "1.8k",
    maintainers: ["Alan Turing"],
    description: "Finds one well-scoped refactor per call and returns it as a diff with test implications.",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-sonnet-4.6",
    template: "You are suggesting ONE refactor for {{file_path}}.\n\n{{diff}}\n\nPolicies: {{policy_list}}",
    variables: [
      { name: "file_path", type: "string", desc: "File to refactor.", default: "—" },
      { name: "diff", type: "code", desc: "Current code context.", default: "(from buffer)" },
      { name: "policy_list", type: "policy[]", desc: "Relevant policies to respect.", default: "workspace.default" },
    ],
    exampleIn: "def compute(a, b):\n    return a + b",
    exampleOut: "Proposed: extract constants and add a type guard. Cost: low. Risk: none.",
    uses30d: [0.4, 0.42, 0.38, 0.5, 0.48, 0.55, 0.6, 0.58, 0.62, 0.65, 0.6, 0.7, 0.72, 0.68, 0.7, 0.74, 0.78, 0.72, 0.8, 0.78, 0.82, 0.8, 0.86, 0.84, 0.82, 0.88, 0.86, 0.9, 0.88, 0.92],
    changelog: [
      { version: "v2.1", date: "2026-04-10", note: "Return one refactor per call; avoid scope creep." },
      { version: "v2.0", date: "2026-03-22", note: "Added risk rating to output." },
      { version: "v1.9", date: "2026-02-28", note: "Dropped import reordering suggestions." },
    ],
  },
  {
    id: "explain-this-function",
    name: "explain-this-function",
    category: "Explain",
    blurb: "Summarizes what a function does, who calls it, and why it exists.",
    stars: 214,
    usage: "3.1k",
    maintainers: ["Grace Hopper", "Ada Lovelace", "Dan Kim"],
    description: "Leans on call-graph and blame data to explain the why, not just the what.",
    vendor: "openai",
    vendorLabel: "OpenAI",
    model: "gpt-5",
    template: "Explain {{file_path}} in one paragraph.\n\n{{diff}}\n\nPolicies: {{policy_list}}",
    variables: [
      { name: "file_path", type: "string", desc: "File containing the function.", default: "—" },
      { name: "diff", type: "code", desc: "Function body + 20 lines of context.", default: "(auto)" },
      { name: "policy_list", type: "policy[]", desc: "Relevant policies to reference.", default: "workspace.default" },
    ],
    exampleIn: "def compute_breakdown(order): ...",
    exampleOut: "Breaks an order into taxable components. Called from checkout.py and the nightly reconciler.",
    uses30d: [0.6, 0.58, 0.62, 0.7, 0.72, 0.68, 0.75, 0.8, 0.78, 0.85, 0.82, 0.88, 0.9, 0.86, 0.92, 0.9, 0.94, 0.9, 0.95, 0.92, 0.96, 0.9, 0.94, 0.92, 0.95, 0.92, 0.96, 0.95, 0.98, 0.95],
    changelog: [
      { version: "v4.1", date: "2026-04-12", note: "Include blame data for authored-by line." },
      { version: "v4.0", date: "2026-03-18", note: "Tightened paragraph to <= 3 sentences." },
      { version: "v3.9", date: "2026-02-20", note: "Added call-graph summary." },
    ],
  },
  {
    id: "generate-tests",
    name: "generate-tests",
    category: "Generate",
    blurb: "Generates pytest-style tests for a function from the spec in docstrings.",
    stars: 81,
    usage: "1.2k",
    maintainers: ["Ada Lovelace"],
    description: "Uses the function's docstring + neighbor tests as the example style.",
    vendor: "google",
    vendorLabel: "Google",
    model: "gemini-2.5-pro",
    template: "Write tests for {{file_path}}.\n\n{{diff}}\n\nPolicies: {{policy_list}}",
    variables: [
      { name: "file_path", type: "string", desc: "Source file to test.", default: "—" },
      { name: "diff", type: "code", desc: "Source code + neighbor tests.", default: "(auto)" },
      { name: "policy_list", type: "policy[]", desc: "Testing policies (coverage, fixtures).", default: "tests.default" },
    ],
    exampleIn: "def evaluate(policy, req): ...",
    exampleOut: "def test_evaluate_allows_owner(): ...",
    uses30d: [0.28, 0.3, 0.32, 0.35, 0.3, 0.34, 0.38, 0.4, 0.38, 0.42, 0.45, 0.4, 0.44, 0.48, 0.45, 0.5, 0.52, 0.48, 0.54, 0.52, 0.58, 0.55, 0.6, 0.58, 0.62, 0.6, 0.65, 0.62, 0.68, 0.64],
    changelog: [
      { version: "v1.8", date: "2026-04-09", note: "Detect pytest fixtures from neighbor files." },
      { version: "v1.7", date: "2026-03-15", note: "Fewer mocks in generated tests." },
      { version: "v1.6", date: "2026-02-22", note: "Include edge cases for empty input." },
    ],
  },
  {
    id: "write-policy-from-example",
    name: "write-policy-from-example",
    category: "Generate",
    blurb: "Turns a plain-language incident into a reusable Quanta policy rule.",
    stars: 44,
    usage: "412",
    maintainers: ["Grace Hopper"],
    description: "Best for turning post-mortems into enforceable policy without learning the DSL.",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-opus-4.7",
    template: "Write a Quanta policy for:\n\n{{diff}}\n\nApplies to: {{file_path}}\nRelated: {{policy_list}}",
    variables: [
      { name: "file_path", type: "string", desc: "Directory the policy should target.", default: "—" },
      { name: "diff", type: "text", desc: "Incident summary or rule in plain English.", default: "—" },
      { name: "policy_list", type: "policy[]", desc: "Similar existing policies for style reference.", default: "workspace.default" },
    ],
    exampleIn: "Don't let PRs merge if they touch billing/* without @billing-owners review.",
    exampleOut: "rule 'billing-needs-owners': path('billing/**') requires review_from('@billing-owners').",
    uses30d: [0.1, 0.12, 0.14, 0.11, 0.15, 0.18, 0.14, 0.2, 0.18, 0.22, 0.2, 0.25, 0.24, 0.28, 0.26, 0.3, 0.28, 0.32, 0.3, 0.35, 0.32, 0.38, 0.35, 0.4, 0.38, 0.42, 0.4, 0.45, 0.42, 0.46],
    changelog: [
      { version: "v0.9", date: "2026-04-08", note: "Emit machine-readable policy AST alongside prose." },
      { version: "v0.8", date: "2026-03-14", note: "Refuse overly broad rules (e.g. path('**'))." },
      { version: "v0.7", date: "2026-02-18", note: "Initial public version." },
    ],
  },
  {
    id: "why-did-this-break",
    name: "why-did-this-break",
    category: "Ask-the-code",
    blurb: "Given a stack trace, walks the call graph to find the likely root cause.",
    stars: 102,
    usage: "892",
    maintainers: ["Alan Turing", "Dan Kim"],
    description: "Prefers code evidence over speculation. Emits a ranked list of hypotheses.",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-opus-4.7",
    template: "Root-cause this:\n\n{{diff}}\n\nFile: {{file_path}}\nPolicies: {{policy_list}}",
    variables: [
      { name: "file_path", type: "string", desc: "Crashing file, if known.", default: "—" },
      { name: "diff", type: "stacktrace", desc: "Stack trace or error log.", default: "—" },
      { name: "policy_list", type: "policy[]", desc: "Incident-related policies.", default: "incidents.default" },
    ],
    exampleIn: "TypeError: cannot unpack non-iterable NoneType object",
    exampleOut: "Likely: fetch_plan() returned None when a plan was missing. Added None-guard missing in checkout.py:118.",
    uses30d: [0.2, 0.22, 0.24, 0.3, 0.28, 0.32, 0.36, 0.34, 0.38, 0.42, 0.4, 0.46, 0.48, 0.44, 0.5, 0.52, 0.56, 0.54, 0.58, 0.6, 0.64, 0.62, 0.66, 0.68, 0.72, 0.7, 0.74, 0.76, 0.8, 0.82],
    changelog: [
      { version: "v1.3", date: "2026-04-11", note: "Weight evidence from recent commits higher." },
      { version: "v1.2", date: "2026-03-20", note: "Added 'last good commit' hint." },
      { version: "v1.1", date: "2026-02-26", note: "Rank hypotheses explicitly." },
    ],
  },
  {
    id: "migration-plan",
    name: "migration-plan",
    category: "Refactor",
    blurb: "Builds a staged migration plan with rollback gates and canaries.",
    stars: 58,
    usage: "320",
    maintainers: ["Grace Hopper"],
    description: "Splits work into phases of <= 3 days each with explicit exit criteria.",
    vendor: "openai",
    vendorLabel: "OpenAI",
    model: "gpt-5",
    template: "Plan a migration from A to B:\n\n{{diff}}\n\nScope: {{file_path}}\nPolicies: {{policy_list}}",
    variables: [
      { name: "file_path", type: "string", desc: "Scope (package or service).", default: "—" },
      { name: "diff", type: "text", desc: "Current vs. target description.", default: "—" },
      { name: "policy_list", type: "policy[]", desc: "Release/rollout policies.", default: "release.default" },
    ],
    exampleIn: "Migrate v1 orders API to v2 (new pricing fields, idempotency keys).",
    exampleOut: "Phase 1: ship /v2 alongside /v1 behind flag. Phase 2: dual-write. Phase 3: cutover.",
    uses30d: [0.06, 0.08, 0.07, 0.1, 0.08, 0.11, 0.13, 0.1, 0.14, 0.16, 0.13, 0.17, 0.2, 0.18, 0.22, 0.2, 0.24, 0.22, 0.26, 0.24, 0.28, 0.25, 0.3, 0.28, 0.32, 0.3, 0.34, 0.32, 0.36, 0.34],
    changelog: [
      { version: "v1.0", date: "2026-04-05", note: "Public release. Added rollback gates." },
      { version: "v0.9", date: "2026-03-10", note: "Enforced phase size <= 3 days." },
      { version: "v0.8", date: "2026-02-12", note: "Added canary step template." },
    ],
  },
  {
    id: "summarize-pr",
    name: "summarize-pr",
    category: "Document",
    blurb: "Writes a release-note-ready summary of a PR, grouped by user impact.",
    stars: 132,
    usage: "1.5k",
    maintainers: ["Ada Lovelace"],
    description: "Focuses on what changed for users, not what files were touched.",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-sonnet-4.6",
    template: "Summarize PR {{file_path}}:\n\n{{diff}}\n\nPolicies: {{policy_list}}",
    variables: [
      { name: "file_path", type: "string", desc: "PR number or branch.", default: "—" },
      { name: "diff", type: "pr_diff", desc: "Full PR diff.", default: "(auto)" },
      { name: "policy_list", type: "policy[]", desc: "Release-notes style policies.", default: "docs.default" },
    ],
    exampleIn: "#482 — fix: idempotency key not propagated through retries",
    exampleOut: "- Orders API now preserves idempotency keys across retries, preventing duplicate charges.",
    uses30d: [0.4, 0.42, 0.45, 0.5, 0.48, 0.52, 0.55, 0.58, 0.6, 0.62, 0.66, 0.64, 0.68, 0.7, 0.74, 0.72, 0.76, 0.78, 0.8, 0.82, 0.84, 0.82, 0.86, 0.88, 0.9, 0.88, 0.9, 0.92, 0.94, 0.92],
    changelog: [
      { version: "v2.4", date: "2026-04-10", note: "Group summaries by user impact, not file." },
      { version: "v2.3", date: "2026-03-18", note: "Skip internal-only changes in summary." },
      { version: "v2.2", date: "2026-02-25", note: "Added breaking-change callout." },
    ],
  },
  {
    id: "find-similar-code",
    name: "find-similar-code",
    category: "Ask-the-code",
    blurb: "Finds structurally similar code across the workspace, grouped by pattern.",
    stars: 71,
    usage: "780",
    maintainers: ["Dan Kim"],
    description: "Uses structural embeddings from the Engine, not text similarity.",
    vendor: "anthropic",
    vendorLabel: "Anthropic",
    model: "claude-haiku-4.5",
    template: "Find similar code to:\n\n{{diff}}\n\nScope: {{file_path}}\nPolicies: {{policy_list}}",
    variables: [
      { name: "file_path", type: "string", desc: "Scope of search.", default: "workspace" },
      { name: "diff", type: "code", desc: "Example snippet to match.", default: "—" },
      { name: "policy_list", type: "policy[]", desc: "Not used; pass for logging.", default: "—" },
    ],
    exampleIn: "retry loop with backoff",
    exampleOut: "12 matches across 9 files; strongest in net/http_client.py and queue/worker.py.",
    uses30d: [0.2, 0.22, 0.2, 0.24, 0.26, 0.28, 0.3, 0.28, 0.32, 0.34, 0.36, 0.38, 0.4, 0.42, 0.44, 0.42, 0.46, 0.48, 0.5, 0.52, 0.54, 0.56, 0.58, 0.6, 0.62, 0.64, 0.66, 0.68, 0.7, 0.72],
    changelog: [
      { version: "v1.5", date: "2026-04-03", note: "Cluster matches by AST pattern." },
      { version: "v1.4", date: "2026-03-11", note: "Switched to Engine structural embeddings." },
      { version: "v1.3", date: "2026-02-14", note: "Ignore vendored/generated files." },
    ],
  },
  {
    id: "generate-runbook",
    name: "generate-runbook",
    category: "Document",
    blurb: "Drafts an on-call runbook from the service's code, alerts, and logs.",
    stars: 38,
    usage: "210",
    maintainers: ["Alan Turing"],
    description: "Writes an opinionated first draft; a human should review before publishing.",
    vendor: "local",
    vendorLabel: "Local",
    model: "quanta-internal-v3",
    template: "Draft a runbook for {{file_path}}:\n\n{{diff}}\n\nPolicies: {{policy_list}}",
    variables: [
      { name: "file_path", type: "string", desc: "Service path.", default: "—" },
      { name: "diff", type: "text", desc: "Known alerts + recent incidents.", default: "—" },
      { name: "policy_list", type: "policy[]", desc: "SRE runbook policies.", default: "sre.default" },
    ],
    exampleIn: "services/orders (alerts: high-error-rate, stale-queue)",
    exampleOut: "1. Check queue depth. 2. Check upstream payment provider. 3. Rollback to last good image.",
    uses30d: [0.02, 0.03, 0.04, 0.05, 0.03, 0.05, 0.06, 0.08, 0.06, 0.1, 0.12, 0.1, 0.14, 0.16, 0.13, 0.18, 0.2, 0.16, 0.22, 0.2, 0.24, 0.22, 0.26, 0.25, 0.28, 0.26, 0.3, 0.28, 0.32, 0.3],
    changelog: [
      { version: "v0.4", date: "2026-04-01", note: "Pull alert definitions from monitoring config." },
      { version: "v0.3", date: "2026-03-05", note: "Cross-link to recent incident postmortems." },
      { version: "v0.2", date: "2026-02-09", note: "Initial draft." },
    ],
  },
];

const CATEGORY_FILTERS = [
  "All",
  "Code review",
  "Refactor",
  "Document",
  "Explain",
  "Generate",
  "Ask-the-code",
] as const;

type ScopeTab = "Team (42)" | "Yours (8)" | "Community (184)";
const SCOPE_TABS: readonly ScopeTab[] = ["Team (42)", "Yours (8)", "Community (184)"];

function CategoryPill({ c, small = false }: { c: Category; small?: boolean }) {
  const color = CATEGORY_COLORS[c];
  const size: CSSProperties = small
    ? { fontSize: "var(--fs-10)", padding: "1px var(--space-1h)" }
    : { fontSize: "var(--fs-10)", padding: "2px var(--space-2)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        ...size,
        background: `color-mix(in srgb, ${color} 14%, var(--bg))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 32%, var(--border))`,
        borderRadius: "var(--radius-xs)",
        fontWeight: 600,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {c}
    </span>
  );
}

function VendorPill({ vendor, label, model }: { vendor: VendorId; label: string; model: string }) {
  const accent = VENDOR_ACCENTS[vendor];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1h)",
        padding: "2px var(--space-2)",
        background: accent.bg,
        border: `1px solid color-mix(in srgb, ${accent.fg} 32%, var(--border))`,
        borderRadius: "var(--radius-xs)",
        fontSize: "var(--fs-xs)",
        fontFamily: "var(--font-mono)",
        color: "var(--fg)",
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 6, height: 6, borderRadius: "50%", background: accent.fg }}
      />
      <span style={{ color: accent.fg, fontWeight: 600 }}>{label}</span>
      <span style={{ color: "var(--fg-muted)" }}>·</span>
      <span>{model}</span>
    </span>
  );
}

function highlightTemplate(src: string): ReactNode {
  const parts = src.split(/(\{\{[^}]+\}\})/g);
  return parts.map((p, i) => {
    if (/^\{\{[^}]+\}\}$/.test(p)) {
      return (
        <span
          key={i}
          style={{
            color: "#fbbf24",
            background: "rgba(251, 191, 36, 0.08)",
            padding: "0 2px",
            borderRadius: 2,
          }}
        >
          {p}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export function PromptLibraryPage() {
  const { navigate } = useDemoNav();
  const [selectedId, setSelectedId] = useState(PROMPTS[0]!.id);
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORY_FILTERS)[number]>("All");
  const [scope, setScope] = useState<ScopeTab>("Team (42)");
  const [query, setQuery] = useState("");
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  const [forked, setForked] = useState<Record<string, boolean>>({});

  const selected = PROMPTS.find((p) => p.id === selectedId) ?? PROMPTS[0]!;
  const isStarred = !!starred[selected.id];
  const isForked = !!forked[selected.id];

  const filtered = PROMPTS.filter((p) => {
    if (categoryFilter !== "All" && p.category !== categoryFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.blurb.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const toggleStar = () => setStarred((s) => ({ ...s, [selected.id]: !s[selected.id] }));
  const toggleFork = () => setForked((s) => ({ ...s, [selected.id]: !s[selected.id] }));

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="AI"
        title="Prompt library"
        sub="Shared prompts across your org. Fork the best, tune for your codebase, and lock in quality."
      />
      <div className="demo-app__body">
        {/* Top bar — two pill-toggle groups + search + new */}
        <div className="demo-sectionbar" style={{ flexWrap: "wrap", gap: "var(--space-2)" }}>
          <div className="demo-billing-toggle" style={{ flex: "0 0 auto" }}>
            {CATEGORY_FILTERS.map((c) => (
              <button
                key={c}
                type="button"
                className={categoryFilter === c ? "is-active" : ""}
                onClick={() => setCategoryFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <span
            aria-hidden="true"
            style={{ width: 1, height: 24, background: "var(--border)", margin: "0 var(--space-1)" }}
          />
          <div className="demo-billing-toggle" style={{ flex: "0 0 auto" }}>
            {SCOPE_TABS.map((s) => (
              <button
                key={s}
                type="button"
                className={scope === s ? "is-active" : ""}
                onClick={() => setScope(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div
            className="demo-field"
            style={{ flex: 1, minWidth: 220, maxWidth: 320, marginLeft: "var(--space-2)" }}
          >
            <div style={{ position: "relative" }}>
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
                placeholder="Search prompts…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ paddingLeft: 28 }}
              />
            </div>
          </div>
          <span className="demo-sectionbar__spacer" />
          <button type="button" className="demo-btn demo-btn--primary">
            <Plus size={13} strokeWidth={1.8} /> New prompt
          </button>
        </div>

        {/* 2-col layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "320px minmax(0, 1fr)",
            gap: "var(--space-4)",
            alignItems: "start",
          }}
        >
          {/* Left: prompt list */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-1h)",
              maxHeight: 820,
              overflowY: "auto",
              paddingRight: "var(--space-1)",
            }}
          >
            {filtered.length === 0 && (
              <div className="demo-empty" style={{ padding: "var(--space-5)" }}>
                <MessageSquare size={22} strokeWidth={1.6} aria-hidden="true" />
                <div className="demo-empty__title">No prompts match</div>
                <div className="demo-empty__hint">Try clearing filters or the search box.</div>
              </div>
            )}
            {filtered.map((p) => {
              const isSel = selectedId === p.id;
              const accent = CATEGORY_COLORS[p.category];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    textAlign: "left",
                    background: isSel ? "var(--bg-subtle)" : "var(--bg)",
                    border: `1px solid ${isSel ? accent : "var(--border)"}`,
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-2h) var(--space-3)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-1h)",
                    cursor: "pointer",
                    boxShadow: isSel ? `0 0 0 2px color-mix(in srgb, ${accent} 18%, transparent)` : "none",
                    transition: "box-shadow 0.12s, border-color 0.12s",
                  }}
                >
                  <header style={{ display: "flex", alignItems: "center", gap: "var(--space-1h)" }}>
                    <CategoryPill c={p.category} small />
                    <span
                      style={{
                        marginLeft: "auto",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: "var(--fs-10)",
                        color: "var(--fg-subtle)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <Star
                        size={11}
                        strokeWidth={1.8}
                        style={{
                          color: starred[p.id] ? "#eab308" : "var(--fg-subtle)",
                          fill: starred[p.id] ? "#eab308" : "none",
                        }}
                      />
                      {p.stars + (starred[p.id] ? 1 : 0)}
                    </span>
                  </header>
                  <div
                    style={{
                      fontSize: "var(--fs-md)",
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      color: "var(--fg)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg-muted)",
                      lineHeight: "var(--lh-snug)",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {p.blurb}
                  </div>
                  <footer style={{ display: "flex", alignItems: "center", gap: "var(--space-1h)" }}>
                    <Avatars names={p.maintainers} max={2} />
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "var(--fs-10)",
                        color: "var(--fg-subtle)",
                      }}
                    >
                      Used {p.usage}× this month
                    </span>
                  </footer>
                </button>
              );
            })}
          </div>

          {/* Right: detail pane */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-3)",
                padding: "var(--space-4)",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--radius-md)",
                  background: `color-mix(in srgb, ${CATEGORY_COLORS[selected.category]} 14%, var(--bg))`,
                  color: CATEGORY_COLORS[selected.category],
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid color-mix(in srgb, ${CATEGORY_COLORS[selected.category]} 32%, var(--border))`,
                  flex: "0 0 auto",
                }}
              >
                <Sparkles size={18} strokeWidth={1.8} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <h2
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-xl)",
                      fontWeight: 700,
                      color: "var(--fg)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {selected.name}
                  </h2>
                  <CategoryPill c={selected.category} />
                  {isForked && <span className="demo-badge demo-badge--accent">Forked</span>}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--fs-xs)",
                    color: "var(--fg-subtle)",
                  }}
                >
                  <Avatars names={selected.maintainers} max={3} />
                  <span>Maintained by {selected.maintainers.join(", ")}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--space-1h)", alignItems: "center" }}>
                <button
                  type="button"
                  className="demo-btn demo-btn--ghost"
                  onClick={toggleStar}
                  aria-pressed={isStarred}
                  aria-label={isStarred ? "Unstar" : "Star"}
                >
                  <Star
                    size={13}
                    strokeWidth={1.8}
                    style={{
                      color: isStarred ? "#eab308" : undefined,
                      fill: isStarred ? "#eab308" : "none",
                    }}
                  />
                  {selected.stars + (isStarred ? 1 : 0)}
                </button>
                <button
                  type="button"
                  className="demo-btn demo-btn--ghost"
                  onClick={toggleFork}
                  aria-pressed={isForked}
                >
                  <GitFork size={13} strokeWidth={1.8} />
                  {isForked ? "Forked" : "Fork"}
                </button>
                <CopyButton value={selected.template} label="Copy" />
              </div>
            </div>

            {/* Description + model */}
            <div className="demo-block">
              <div className="demo-block__body">
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-sm)",
                    color: "var(--fg)",
                    lineHeight: "var(--lh-relaxed)",
                  }}
                >
                  {selected.description}
                </p>
                <div
                  style={{
                    marginTop: "var(--space-3)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2h)",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-1h)",
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg-subtle)",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    <Bot size={12} strokeWidth={1.8} /> Model preference
                  </span>
                  <VendorPill
                    vendor={selected.vendor}
                    label={selected.vendorLabel}
                    model={selected.model}
                  />
                  <button
                    type="button"
                    className="demo-btn demo-btn--ghost"
                    onClick={() => navigate("ai.models")}
                    style={{ marginLeft: "auto" }}
                  >
                    Change model
                    <ChevronRight size={12} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </div>

            {/* Template */}
            <DarkPanel padding="0" borderRadius="var(--radius-md)">
              <DarkPanelHeader
                right={<CopyButton value={selected.template} variant="soft" size="sm" />}
              >
                <ScrollText size={12} strokeWidth={1.8} style={{ color: "#9ca3af" }} />
                <span style={{ color: "#e4e4e4", fontWeight: 600 }}>template.md</span>
                <span style={{ color: "#6b7280", fontSize: 10 }}>
                  {selected.template.split("\n").length} lines · {selected.template.length} chars
                </span>
              </DarkPanelHeader>
              <DarkPanelBody padding="var(--space-3h) var(--space-4)">
                <pre
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "#e4e4e4",
                    lineHeight: 1.65,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {highlightTemplate(selected.template)}
                </pre>
              </DarkPanelBody>
            </DarkPanel>

            {/* Variables */}
            <div className="demo-block">
              <header className="demo-block__head">
                <div>
                  <div className="demo-block__title">Variables</div>
                  <div className="demo-block__sub">
                    Quanta fills these from the call-site; defaults apply when missing.
                  </div>
                </div>
              </header>
              <div className="demo-block__body">
                <div
                  className="demo-kv"
                  style={{ gridTemplateColumns: "200px minmax(0, 1fr)" }}
                >
                  {selected.variables.map((v) => (
                    <div key={v.name} style={{ display: "contents" }}>
                      <div className="demo-kv__k">
                        <code style={{ fontFamily: "var(--font-mono)", color: "#fbbf24" }}>
                          {`{{${v.name}}}`}
                        </code>
                        <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", marginTop: 2 }}>
                          {v.type}
                        </div>
                      </div>
                      <div className="demo-kv__v">
                        {v.desc}
                        <div
                          style={{
                            fontSize: "var(--fs-10)",
                            color: "var(--fg-subtle)",
                            marginTop: 2,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          default: {v.default}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Example run — side-by-side */}
            <div className="demo-block">
              <header className="demo-block__head">
                <div>
                  <div className="demo-block__title">Example run</div>
                  <div className="demo-block__sub">Most recent successful call, redacted.</div>
                </div>
              </header>
              <div className="demo-block__body">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                    gap: "var(--space-3)",
                  }}
                >
                  <DarkPanel padding="0" borderRadius="var(--radius-md)">
                    <DarkPanelHeader>
                      <span style={{ color: "#9ca3af", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        Input
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
                        }}
                      >
                        {selected.exampleIn}
                      </pre>
                    </DarkPanelBody>
                  </DarkPanel>
                  <DarkPanel padding="0" borderRadius="var(--radius-md)">
                    <DarkPanelHeader>
                      <span style={{ color: "#9ca3af", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        Output
                      </span>
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
                        }}
                      >
                        {selected.exampleOut}
                      </pre>
                    </DarkPanelBody>
                  </DarkPanel>
                </div>
              </div>
            </div>

            {/* Usage chart + changelog */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "var(--space-3)",
              }}
            >
              <div className="demo-block">
                <header className="demo-block__head">
                  <div>
                    <div className="demo-block__title">Usage · last 30 days</div>
                    <div className="demo-block__sub">Calls/day across the workspace.</div>
                  </div>
                  <span className="demo-sectionbar__spacer" />
                  <span
                    className="demo-badge"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {selected.usage} / mo
                  </span>
                </header>
                <div className="demo-block__body">
                  <Sparkline
                    values={selected.uses30d}
                    width={420}
                    height={72}
                    color={vendorFg(selected.vendor)}
                    strokeWidth={2}
                  />
                </div>
              </div>
              <div className="demo-block">
                <header className="demo-block__head">
                  <div>
                    <div className="demo-block__title">Recent changes</div>
                    <div className="demo-block__sub">Three most recent versions.</div>
                  </div>
                </header>
                <div className="demo-block__body">
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {selected.changelog.map((c) => (
                      <li
                        key={c.version}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto auto minmax(0, 1fr)",
                          gap: "var(--space-2)",
                          alignItems: "baseline",
                          fontSize: "var(--fs-xs)",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            color: "var(--fg)",
                          }}
                        >
                          {c.version}
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            color: "var(--fg-subtle)",
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--fs-10)",
                          }}
                        >
                          <Clock size={10} strokeWidth={1.8} />
                          {c.date}
                        </span>
                        <span style={{ color: "var(--fg-muted)", lineHeight: "var(--lh-snug)" }}>
                          {c.note}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
