import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  AlertOctagon,
  BadgeCheck,
  Boxes,
  Check,
  Database,
  Eye,
  FileWarning,
  Flag,
  KeyRound,
  Lock,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  TestTube2,
  Upload,
  Workflow,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { Avatars } from "../../internal/Avatars";

type Category =
  | "Security"
  | "Compliance"
  | "Performance"
  | "Data quality"
  | "AI safety"
  | "Language-specific"
  | "Supply chain"
  | "Ops"
  | "Architecture";

const CATEGORIES = [
  "All",
  "Security",
  "Compliance",
  "Performance",
  "Data quality",
  "AI safety",
  "Language-specific",
  "Supply chain",
  "Ops",
] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

interface Template {
  id: string;
  name: string;
  category: Category;
  description: string;
  installs: string;
  enabled: string;
  maintainers: string[];
  Icon: typeof ShieldAlert;
  tone: string;
}

const TEMPLATES: Template[] = [
  {
    id: "no-direct-db-access",
    name: "no-direct-db-access",
    category: "Security",
    description:
      "Block raw SQL drivers from service layers. Force all DB access through the repository module.",
    installs: "8.9k",
    enabled: "92%",
    maintainers: ["Ada Lovelace", "Alan Turing"],
    Icon: Database,
    tone: "var(--danger)",
  },
  {
    id: "require-tests-for-handlers",
    name: "require-tests-for-handlers",
    category: "Compliance",
    description:
      "Every HTTP handler must have at least one test. Enforced on PR with a friendly fix hint.",
    installs: "6.2k",
    enabled: "87%",
    maintainers: ["Grace Hopper", "Linus Torvalds", "Donald Knuth"],
    Icon: TestTube2,
    tone: "var(--accent)",
  },
  {
    id: "async-in-handler-check",
    name: "async-in-handler-check",
    category: "Performance",
    description:
      "Catch blocking IO inside async handlers — protects the event loop from cascade stalls.",
    installs: "4.1k",
    enabled: "78%",
    maintainers: ["Rich Hickey", "Grace Hopper"],
    Icon: Activity,
    tone: "var(--warn)",
  },
  {
    id: "null-column-guard",
    name: "null-column-guard",
    category: "Data quality",
    description:
      "Flag nullable columns that silently drop rows in aggregations. Emits a plan-preview patch.",
    installs: "2.7k",
    enabled: "81%",
    maintainers: ["Katherine Johnson", "Margaret Hamilton"],
    Icon: FileWarning,
    tone: "var(--fg-muted)",
  },
  {
    id: "prompt-injection-guard",
    name: "prompt-injection-guard",
    category: "AI safety",
    description:
      "Detect unsanitized user input flowing into LLM prompts. Suggests template-based mitigations.",
    installs: "3.4k",
    enabled: "69%",
    maintainers: ["Ada Lovelace", "Barbara Liskov"],
    Icon: Sparkles,
    tone: "#6d28d9",
  },
  {
    id: "python-import-order",
    name: "python-import-order",
    category: "Language-specific",
    description:
      "Enforces PEP 8 import order with project-aware first-party detection. Auto-fix available.",
    installs: "5.5k",
    enabled: "94%",
    maintainers: ["Guido van Rossum", "Raymond Hettinger"],
    Icon: Terminal,
    tone: "var(--accent)",
  },
  {
    id: "dep-confusion-guard",
    name: "dep-confusion-guard",
    category: "Supply chain",
    description:
      "Detects typosquatted or namespace-confusion installs. Cross-checks internal package registry.",
    installs: "4.8k",
    enabled: "88%",
    maintainers: ["Bruce Schneier", "Radia Perlman"],
    Icon: Boxes,
    tone: "var(--warn)",
  },
  {
    id: "pii-in-logs",
    name: "pii-in-logs",
    category: "Compliance",
    description:
      "GDPR/CCPA — redacts recognized PII patterns (email, SSN, card, phone) before log emission.",
    installs: "7.1k",
    enabled: "96%",
    maintainers: ["Grace Hopper", "Whitfield Diffie"],
    Icon: Lock,
    tone: "var(--accent)",
  },
  {
    id: "feature-flag-cleanup",
    name: "feature-flag-cleanup",
    category: "Ops",
    description:
      "Surfaces stale flags older than 90 days. Suggests a PR to delete dead branches.",
    installs: "2.2k",
    enabled: "71%",
    maintainers: ["Kent Beck", "Martin Fowler"],
    Icon: Flag,
    tone: "var(--fg-muted)",
  },
  {
    id: "monorepo-package-boundaries",
    name: "monorepo-package-boundaries",
    category: "Architecture",
    description:
      "Enforces allowed-imports matrix across packages. Blocks sneaky cross-package reaches.",
    installs: "1.9k",
    enabled: "83%",
    maintainers: ["Rich Hickey", "Ada Lovelace"],
    Icon: Workflow,
    tone: "var(--accent)",
  },
  {
    id: "shell-injection-guard",
    name: "shell-injection-guard",
    category: "Security",
    description:
      "Flags os.system / subprocess.shell=True with untrusted inputs. Safer-exec template offered.",
    installs: "3.9k",
    enabled: "90%",
    maintainers: ["Alan Turing", "Bruce Schneier"],
    Icon: AlertOctagon,
    tone: "var(--danger)",
  },
  {
    id: "ai-model-drift-detector",
    name: "ai-model-drift-detector",
    category: "AI safety",
    description:
      "Tracks embedding distribution shifts per deployment. Alerts when p95 drift exceeds threshold.",
    installs: "1.3k",
    enabled: "64%",
    maintainers: ["Barbara Liskov", "Katherine Johnson"],
    Icon: Sparkles,
    tone: "#6d28d9",
  },
];

const CATEGORY_BADGE: Partial<Record<Category, string>> = {
  Security: "demo-badge demo-badge--danger",
  Compliance: "demo-badge demo-badge--accent",
  Performance: "demo-badge demo-badge--warn",
  "Data quality": "demo-badge",
  "AI safety": "demo-badge demo-badge--accent",
  "Language-specific": "demo-badge",
  "Supply chain": "demo-badge demo-badge--warn",
  Ops: "demo-badge",
  Architecture: "demo-badge demo-badge--accent",
};

interface OwnedPolicy {
  id: string;
  name: string;
  sub: string;
  Icon: typeof ShieldCheck;
}

const OWNED: OwnedPolicy[] = [
  {
    id: "acme-jwt-required",
    name: "acme-jwt-required",
    sub: "Authored by you · 3 services attached",
    Icon: KeyRound,
  },
  {
    id: "acme-no-console-log",
    name: "acme-no-console-log",
    sub: "Authored by you · 8 services attached",
    Icon: FileWarning,
  },
  {
    id: "acme-owned-error-codes",
    name: "acme-owned-error-codes",
    sub: "Authored by you · 5 services attached",
    Icon: BadgeCheck,
  },
];

const CONTRIBUTORS = [
  "Ada Lovelace",
  "Alan Turing",
  "Grace Hopper",
  "Donald Knuth",
  "Margaret Hamilton",
  "Guido van Rossum",
  "Linus Torvalds",
  "Rich Hickey",
  "Barbara Liskov",
  "Katherine Johnson",
  "Bruce Schneier",
  "Radia Perlman",
];

function iconTileStyle(tone: string, size: number): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: "var(--radius-md)",
    background: "var(--bg-subtle)",
    color: tone,
    border: "1px solid var(--border)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  };
}

export function PolicyTemplatesPage() {
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<CategoryFilter>>(
    new Set(["All"]),
  );
  const [sort, setSort] = useState("popular");
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  const toggleCategory = (c: CategoryFilter) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (c === "All") {
        return new Set<CategoryFilter>(["All"]);
      }
      next.delete("All");
      if (next.has(c)) next.delete(c);
      else next.add(c);
      if (next.size === 0) next.add("All");
      return next;
    });
  };

  const toggleInstall = (id: string) => {
    setInstalled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = activeCategories.has("All");
    let list = TEMPLATES.filter((t) => {
      const matchesQ =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q);
      const matchesCat =
        all || activeCategories.has(t.category as CategoryFilter);
      return matchesQ && matchesCat;
    });
    if (sort === "az") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "recent") {
      list = [...list].reverse();
    }
    return list;
  }, [search, activeCategories, sort]);

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Admin"
        title="Policy template gallery"
        sub="Start with a battle-tested policy. Fork, tune, and ship. Templates are updated by the community and verified by Quanta."
      />
      <div className="demo-app__body">
        {/* ==================== FILTER BAR ==================== */}
        <div className="demo-sectionbar">
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
              flex: 1,
              maxWidth: 360,
            }}
          >
            <Search size={13} strokeWidth={2} aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates by name or description"
              aria-label="Search templates"
              style={{
                border: 0,
                outline: "none",
                background: "transparent",
                color: "var(--fg)",
                font: "inherit",
                width: "100%",
              }}
            />
          </div>
          <span className="demo-sectionbar__spacer" />
          <select
            className="demo-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort by"
            style={{ width: 150 }}
          >
            <option value="popular">Most used</option>
            <option value="recent">Recently added</option>
            <option value="az">A → Z</option>
          </select>
          <button className="demo-btn demo-btn--primary">
            <Upload size={13} strokeWidth={1.8} aria-hidden /> Submit template
          </button>
        </div>

        {/* ==================== CATEGORY CHIPS ==================== */}
        <div
          className="demo-billing-toggle"
          role="group"
          aria-label="Category filters"
          style={{ flexWrap: "wrap" }}
        >
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={activeCategories.has(c) ? "is-active" : ""}
              aria-pressed={activeCategories.has(c)}
              onClick={() => toggleCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* ==================== FEATURED ==================== */}
        <article
          style={{
            marginTop: "var(--space-4)",
            border: "1px solid var(--accent)",
            background: "var(--bg-accent-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-5)",
            display: "grid",
            gridTemplateColumns: "80px minmax(0, 1fr) auto",
            gap: "var(--space-4)",
            alignItems: "center",
          }}
        >
          <span style={iconTileStyle("var(--accent)", 80)}>
            <ShieldAlert size={32} strokeWidth={1.6} aria-hidden />
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--fs-10)",
                fontWeight: "var(--fw-bold)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--accent)",
                marginBottom: 4,
              }}
            >
              Featured · Verified by Quanta
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: "var(--fs-lg)",
                fontWeight: "var(--fw-bold)",
                fontFamily: "var(--font-mono)",
                letterSpacing: 0,
              }}
            >
              secrets-in-commits
            </h3>
            <p
              style={{
                margin: "var(--space-1h) 0 var(--space-2h)",
                color: "var(--fg-muted)",
                fontSize: "var(--fs-sm)",
                lineHeight: "var(--lh-relaxed)",
              }}
            >
              Prevent accidental commits of API keys, tokens, and credentials.
              Detects 40+ secret formats — AWS, Stripe, Slack webhooks, JWTs,
              RSA private keys — and offers an auto-patch to the surrounding file.
            </p>
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                flexWrap: "wrap",
              }}
            >
              <span className="demo-badge demo-badge--accent">Installed 12,400×</span>
              <span className="demo-badge">Catches 180 violations/wk avg</span>
              <span className="demo-badge demo-badge--success">
                <BadgeCheck size={10} strokeWidth={2} style={{ marginRight: 4, verticalAlign: "-1px" }} aria-hidden />
                Verified
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
              alignItems: "stretch",
              minWidth: 160,
            }}
          >
            <button
              type="button"
              className={
                installed.has("secrets-in-commits")
                  ? "demo-btn demo-btn--ghost"
                  : "demo-btn demo-btn--primary"
              }
              onClick={() => toggleInstall("secrets-in-commits")}
            >
              {installed.has("secrets-in-commits") ? (
                <>
                  <Check size={13} strokeWidth={2} aria-hidden /> Installed
                </>
              ) : (
                <>
                  <Plus size={13} strokeWidth={1.8} aria-hidden /> Install
                </>
              )}
            </button>
            <button type="button" className="demo-btn demo-btn--ghost">
              <Eye size={13} strokeWidth={1.8} aria-hidden /> Preview
            </button>
          </div>
        </article>

        {/* ==================== TEMPLATES GRID ==================== */}
        <h2
          style={{
            margin: "var(--space-5) 0 var(--space-2)",
            fontSize: "var(--fs-lg)",
            fontWeight: "var(--fw-bold)",
            letterSpacing: "-0.01em",
          }}
        >
          All templates
          <span
            style={{
              marginLeft: "var(--space-2)",
              fontSize: "var(--fs-xs)",
              color: "var(--fg-subtle)",
              fontWeight: "var(--fw-medium)",
              letterSpacing: 0,
            }}
          >
            {filtered.length} of {TEMPLATES.length}
          </span>
        </h2>

        {filtered.length === 0 ? (
          <div className="demo-empty">
            <div className="demo-empty__title">No templates match</div>
            <div className="demo-empty__hint">
              Try clearing filters or search, then browse by category.
            </div>
          </div>
        ) : (
          <div className="demo-grid-3">
            {filtered.map((t) => {
              const isInstalled = installed.has(t.id);
              return (
                <article
                  key={t.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg)",
                    padding: "var(--space-3h)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                  }}
                >
                  <header
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "var(--space-2)",
                    }}
                  >
                    <span style={iconTileStyle(t.tone, 36)}>
                      <t.Icon size={16} strokeWidth={1.8} aria-hidden />
                    </span>
                    <span className={CATEGORY_BADGE[t.category] ?? "demo-badge"}>
                      {t.category}
                    </span>
                  </header>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "var(--fs-md)",
                      fontWeight: "var(--fw-semibold)",
                      fontFamily: "var(--font-mono)",
                      letterSpacing: 0,
                    }}
                  >
                    {t.name}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg-muted)",
                      lineHeight: "var(--lh-relaxed)",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {t.description}
                  </p>
                  <div
                    style={{
                      fontSize: "var(--fs-10)",
                      color: "var(--fg-subtle)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      fontWeight: "var(--fw-semibold)",
                    }}
                  >
                    {t.installs} installs · {t.enabled} enabled · {t.maintainers.length} maintainer
                    {t.maintainers.length === 1 ? "" : "s"}
                  </div>
                  <div style={{ marginTop: 2 }}>
                    <Avatars names={t.maintainers} max={3} />
                  </div>
                  <footer
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "var(--space-2)",
                      marginTop: "var(--space-2)",
                      paddingTop: "var(--space-2h)",
                      borderTop: "1px dashed var(--border)",
                    }}
                  >
                    <button type="button" className="demo-btn demo-btn--ghost">
                      <Eye size={12} strokeWidth={1.8} aria-hidden /> Preview
                    </button>
                    <button
                      type="button"
                      className={
                        isInstalled
                          ? "demo-btn demo-btn--ghost"
                          : "demo-btn demo-btn--primary"
                      }
                      onClick={() => toggleInstall(t.id)}
                      aria-pressed={isInstalled}
                    >
                      {isInstalled ? (
                        <>
                          <Check size={12} strokeWidth={2} aria-hidden /> Installed
                        </>
                      ) : (
                        <>
                          <Plus size={12} strokeWidth={1.8} aria-hidden /> Install
                        </>
                      )}
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {/* ==================== YOUR POLICIES ==================== */}
        <section style={{ marginTop: "var(--space-6)" }}>
          <header
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: "var(--space-2h)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "var(--fs-lg)",
                fontWeight: "var(--fw-bold)",
                letterSpacing: "-0.01em",
              }}
            >
              Your policies
            </h2>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>
              Authored by your workspace · can be promoted to templates
            </span>
          </header>
          <div className="demo-grid-3">
            {OWNED.map((p) => (
              <article
                key={p.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg)",
                  padding: "var(--space-3)",
                  display: "grid",
                  gridTemplateColumns: "36px minmax(0, 1fr) auto",
                  gap: "var(--space-3)",
                  alignItems: "center",
                }}
              >
                <span style={iconTileStyle("var(--fg-muted)", 36)}>
                  <p.Icon size={16} strokeWidth={1.8} aria-hidden />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-sm)",
                      fontWeight: "var(--fw-semibold)",
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>
                    {p.sub}
                  </div>
                </div>
                <button type="button" className="demo-btn demo-btn--ghost">
                  <Upload size={12} strokeWidth={1.8} aria-hidden /> Promote
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* ==================== CONTRIBUTORS ==================== */}
        <section
          style={{
            marginTop: "var(--space-5)",
            padding: "var(--space-4)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-subtle)",
            display: "grid",
            gridTemplateColumns: "auto minmax(0, 1fr) auto",
            gap: "var(--space-3)",
            alignItems: "center",
          }}
        >
          <span style={iconTileStyle("var(--accent)", 44)}>
            <ShieldCheck size={20} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <div
              style={{
                fontSize: "var(--fs-sm)",
                fontWeight: "var(--fw-semibold)",
                marginBottom: 2,
              }}
            >
              Made by the community — 230 contributors this quarter
            </div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
              Templates here are open-source and maintained by policy authors across 47 companies.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Avatars names={CONTRIBUTORS} max={6} />
            <button type="button" className="demo-btn demo-btn--ghost">
              View all
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
