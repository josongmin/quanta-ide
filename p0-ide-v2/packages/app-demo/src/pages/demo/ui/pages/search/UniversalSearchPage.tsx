import { useMemo, useState } from "react";
import {
  CornerDownLeft,
  FileCode,
  FileText,
  Hash,
  LifeBuoy,
  Search,
  ShieldCheck,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useDemoNav } from "../../DemoPage";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { initials, pickPalette } from "../../internal/avatar-utils";

type GroupKey =
  | "code"
  | "symbols"
  | "members"
  | "policies"
  | "tickets"
  | "docs"
  | "commands";

interface ResultItem {
  title: string;
  subtitle: string;
  breadcrumb: string;
  score: number;
  person?: string;
  navId?: string;
}

interface Group {
  key: GroupKey;
  label: string;
  icon: LucideIcon;
  items: ResultItem[];
}

const GROUPS: Group[] = [
  {
    key: "code",
    label: "Code",
    icon: FileCode,
    items: [
      {
        title: "packages/app-policy/src/rules/no-db-access.ts",
        subtitle:
          "export function evaluate(policy: PolicyContext): PolicyViolation[] {",
        breadcrumb: "app-policy › rules",
        score: 98,
      },
      {
        title: "packages/canvas-engine/src/policy-engine.ts",
        subtitle:
          "// Walks AST edges and emits a policy violation per forbidden import.",
        breadcrumb: "canvas-engine › src",
        score: 91,
      },
      {
        title: ".semgrep/rules/secrets-in-commits.yml",
        subtitle:
          "id: secrets-in-commits # supersedes legacy policy-violation pattern",
        breadcrumb: ".semgrep › rules",
        score: 82,
      },
    ],
  },
  {
    key: "symbols",
    label: "Symbols",
    icon: Hash,
    items: [
      {
        title: "function evaluatePolicyViolation",
        subtitle: "(ctx: PolicyContext, rule: Rule): Violation | null",
        breadcrumb: "app-policy › evaluator.ts:42",
        score: 96,
      },
      {
        title: "class PolicyViolationReporter",
        subtitle: "Batches violation events and flushes to the gate runner.",
        breadcrumb: "app-policy › reporter.ts:12",
        score: 88,
      },
      {
        title: "const POLICY_VIOLATION_CODES",
        subtitle:
          "Record<PolicyCode, { severity: Severity; humanLabel: string }>",
        breadcrumb: "app-policy › codes.ts:3",
        score: 76,
      },
    ],
  },
  {
    key: "members",
    label: "Members",
    icon: Users,
    items: [
      {
        title: "Ada Lovelace",
        subtitle: "Policy team · reviewed 14 policy violation tickets",
        breadcrumb: "Workspace · Acme",
        score: 94,
        person: "Ada Lovelace",
      },
      {
        title: "Mei Zhang",
        subtitle: "Reviews · on-call for policy violation escalations",
        breadcrumb: "Workspace · Acme",
        score: 81,
        person: "Mei Zhang",
      },
      {
        title: "Haruto Ito",
        subtitle: "OSS · authored 3 policy violation fixtures",
        breadcrumb: "Workspace · Acme",
        score: 69,
        person: "Haruto Ito",
      },
    ],
  },
  {
    key: "policies",
    label: "Policies",
    icon: ShieldCheck,
    items: [
      {
        title: "no-direct-db-access",
        subtitle: "5 violations in the last 24h · gate BLOCKING",
        breadcrumb: "Policies › infra",
        score: 97,
      },
      {
        title: "secrets-in-commits",
        subtitle: "Prevents committing policy violation fixtures with real keys",
        breadcrumb: "Policies › security",
        score: 86,
      },
      {
        title: "dependency-confusion-guard",
        subtitle: "Fires a policy violation when an internal name resolves public",
        breadcrumb: "Policies › supply-chain",
        score: 74,
      },
    ],
  },
  {
    key: "tickets",
    label: "Tickets",
    icon: LifeBuoy,
    items: [
      {
        title: "Analysis stuck on CI for PR #482",
        subtitle:
          "TK-2026-00142 · awaiting reply · related to policy violation webhook",
        breadcrumb: "Support › open",
        score: 89,
        navId: "support.ticket",
      },
      {
        title: "Policy violation false positives on generated code",
        subtitle:
          "TK-2026-00117 · open · 3 replies · no-direct-db-access flagged ORM stubs",
        breadcrumb: "Support › open",
        score: 85,
        navId: "support.ticket",
      },
    ],
  },
  {
    key: "docs",
    label: "Docs",
    icon: FileText,
    items: [
      {
        title: "Policy DSL reference",
        subtitle:
          "Predicate grammar, built-ins, and how a policy violation maps to a Gate outcome.",
        breadcrumb: "Docs › policies",
        score: 92,
      },
      {
        title: "Configuring gates in CI",
        subtitle:
          "How to fail a PR when a policy violation has severity >= error.",
        breadcrumb: "Docs › ci",
        score: 79,
      },
      {
        title: "Violation triage playbook",
        subtitle:
          "Runbook for acknowledging, silencing, or promoting a policy violation.",
        breadcrumb: "Docs › runbooks",
        score: 71,
      },
    ],
  },
  {
    key: "commands",
    label: "Commands",
    icon: Zap,
    items: [
      {
        title: "Open policy editor",
        subtitle: "Edit rules that emit a policy violation",
        breadcrumb: "⌘⇧E",
        score: 90,
      },
      {
        title: "Run policy dry-run",
        subtitle: "Preview policy violation output without blocking a gate",
        breadcrumb: "⌘R",
        score: 77,
      },
      {
        title: "Jump to violations",
        subtitle: "Focus the next policy violation in the current workspace",
        breadcrumb: "V",
        score: 66,
      },
    ],
  },
];

const GROUP_TINT: Record<GroupKey, string> = {
  code: "var(--bg-accent-subtle)",
  symbols: "var(--bg-subtle)",
  members: "var(--bg-success-subtle)",
  policies: "var(--bg-success-subtle)",
  tickets: "var(--bg-warn-subtle)",
  docs: "var(--bg-subtle)",
  commands: "var(--bg-accent-subtle)",
};

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 20,
        height: 20,
        padding: "0 var(--space-1)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-10)",
        fontWeight: "var(--fw-semibold)",
        color: "var(--fg)",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderBottomWidth: 2,
        borderRadius: "var(--radius-xs)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      {children}
    </kbd>
  );
}

function highlight(text: string, needle: string): React.ReactNode {
  const n = needle.trim();
  if (!n) return text;
  const idx = text.toLowerCase().indexOf(n.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          background: "var(--bg-warn-subtle)",
          color: "var(--fg)",
          borderRadius: 2,
          padding: "0 2px",
        }}
      >
        {text.slice(idx, idx + n.length)}
      </mark>
      {text.slice(idx + n.length)}
    </>
  );
}

interface ResultRowProps {
  item: ResultItem;
  groupKey: GroupKey;
  needle: string;
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onActivate: () => void;
}

function ResultRow({
  item,
  groupKey,
  needle,
  active,
  onEnter,
  onLeave,
  onActivate,
}: ResultRowProps) {
  const showPerson = groupKey === "members" && item.person;
  const pal = item.person ? pickPalette(item.person) : null;
  return (
    <li
      role="option"
      aria-selected={active}
      tabIndex={0}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter") onActivate();
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "28px minmax(0, 1fr) auto",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-2) var(--space-2h)",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        background: active ? "var(--bg-hover)" : "transparent",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          borderRadius: "var(--radius-sm)",
          background: showPerson && pal ? pal.bg : "var(--bg-subtle)",
          color: showPerson && pal ? pal.fg : "var(--fg-muted)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: showPerson ? 10 : undefined,
          fontWeight: "var(--fw-semibold)",
          border: "1px solid var(--border)",
        }}
      >
        {showPerson && item.person ? initials(item.person) : <RowIcon group={groupKey} />}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--fs-sm)",
            color: "var(--fg)",
            fontWeight: "var(--fw-medium)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily:
              groupKey === "code" || groupKey === "symbols"
                ? "var(--font-mono)"
                : undefined,
          }}
        >
          {highlight(item.title, needle)}
        </div>
        <div
          style={{
            fontSize: "var(--fs-xs)",
            color: "var(--fg-subtle)",
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {highlight(item.subtitle, needle)}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}
      >
        <span
          style={{
            fontSize: "var(--fs-10)",
            color: "var(--fg-subtle)",
            fontFamily: "var(--font-mono)",
            padding: "2px var(--space-1h)",
            borderRadius: "var(--radius-xs)",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
          }}
        >
          {item.breadcrumb}
        </span>
        <span
          style={{
            fontSize: "var(--fs-10)",
            color: "var(--fg-subtle)",
            fontVariantNumeric: "tabular-nums",
            minWidth: 28,
            textAlign: "right",
          }}
          aria-label={`Relevance score ${item.score}`}
        >
          {item.score}
        </span>
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: "var(--fs-10)",
            color: active ? "var(--fg)" : "var(--fg-subtle)",
            opacity: active ? 1 : 0.6,
            transition: "opacity 120ms ease",
          }}
        >
          <CornerDownLeft size={11} strokeWidth={1.8} /> open
        </span>
      </div>
    </li>
  );
}

function RowIcon({ group }: { group: GroupKey }) {
  const Icon =
    group === "code"
      ? FileCode
      : group === "symbols"
        ? Hash
        : group === "members"
          ? Users
          : group === "policies"
            ? ShieldCheck
            : group === "tickets"
              ? LifeBuoy
              : group === "docs"
                ? FileText
                : Zap;
  return <Icon size={13} strokeWidth={1.8} />;
}

export function UniversalSearchPage() {
  const nav = useDemoNav();
  const [q, setQ] = useState("policy violation");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          i.title.toLowerCase().includes(needle) ||
          i.subtitle.toLowerCase().includes(needle),
      ),
    })).filter((g) => g.items.length > 0);
  }, [q]);

  const totalCount = filtered.reduce((s, g) => s + g.items.length, 0);

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Search"
        title="Universal search"
        sub="One query across code, symbols, members, policies, tickets, docs, and commands. Press ⌘K anywhere to open."
      />
      <div className="demo-app__body">
        {/* Big search input */}
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto var(--space-5)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2h)",
            padding: "0 var(--space-4)",
            height: 56,
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <Search
            size={20}
            strokeWidth={1.8}
            style={{ color: "var(--fg-muted)" }}
            aria-hidden="true"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search across your workspace"
            aria-label="Search"
            style={{
              flex: 1,
              border: 0,
              outline: "none",
              background: "transparent",
              color: "var(--fg)",
              font: "inherit",
              fontSize: "var(--fs-lg)",
            }}
          />
          <Kbd>⌘K</Kbd>
        </div>

        {/* Result counter */}
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto var(--space-4)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--fs-xs)",
            color: "var(--fg-subtle)",
            letterSpacing: "0.04em",
          }}
        >
          <span>{totalCount} results</span>
          <span>·</span>
          <span>across {filtered.length} groups</span>
          <span style={{ marginLeft: "auto", fontSize: "var(--fs-10)" }}>
            Tip: quote "exact phrase" for literal match
          </span>
        </div>

        {filtered.length === 0 && (
          <div
            className="demo-empty"
            style={{ maxWidth: 900, margin: "0 auto" }}
          >
            <Search size={28} strokeWidth={1.5} aria-hidden="true" />
            <div className="demo-empty__title">No results</div>
            <div className="demo-empty__hint">
              Try a shorter query or a different word.
            </div>
          </div>
        )}

        {filtered.map((g) => {
          const GroupIcon = g.icon;
          return (
            <section
              key={g.key}
              style={{
                maxWidth: 900,
                margin: "0 auto",
                marginBottom: "var(--space-5)",
              }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  paddingBottom: "var(--space-2)",
                  borderBottom: "1px solid var(--border)",
                  marginBottom: "var(--space-1)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "var(--radius-sm)",
                    background: GROUP_TINT[g.key],
                    color: "var(--fg-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border)",
                  }}
                >
                  <GroupIcon size={12} strokeWidth={1.8} />
                </span>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-xs)",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--fg-muted)",
                  }}
                >
                  {g.label}
                </h3>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "var(--fs-10)",
                    color: "var(--fg-subtle)",
                  }}
                >
                  {g.items.length} results
                </span>
              </header>
              <ul
                role="listbox"
                aria-label={`${g.label} results`}
                style={{ listStyle: "none", padding: 0, margin: 0 }}
              >
                {g.items.map((item, idx) => {
                  const rowKey = `${g.key}-${idx}`;
                  return (
                    <ResultRow
                      key={rowKey}
                      item={item}
                      groupKey={g.key}
                      needle={q}
                      active={activeKey === rowKey}
                      onEnter={() => setActiveKey(rowKey)}
                      onLeave={() => setActiveKey(null)}
                      onActivate={() => {
                        if (item.navId) nav.navigate(item.navId);
                        // eslint-disable-next-line no-console
                        else console.log("[demo] open result", g.key, item.title);
                      }}
                    />
                  );
                })}
              </ul>
            </section>
          );
        })}

        {/* Footer strip */}
        <div
          style={{
            maxWidth: 900,
            margin: "var(--space-5) auto 0",
            display: "flex",
            justifyContent: "center",
            gap: "var(--space-4)",
            paddingTop: "var(--space-4)",
            borderTop: "1px dashed var(--border)",
            fontSize: "var(--fs-10)",
            color: "var(--fg-subtle)",
            letterSpacing: "0.06em",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
            }}
          >
            <Kbd>↑↓</Kbd> navigate
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
            }}
          >
            <Kbd>↵</Kbd> open
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
            }}
          >
            <Kbd>⌘↵</Kbd> open in new tab
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
            }}
          >
            <Kbd>esc</Kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
