import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  listAnalysisCatalogRecords,
  primeUniverseLaunch,
  type AnalysisCatalogRecord,
  type EvidenceClass,
  type InsightDomain,
} from "@quanta/code-universe";
import { tabBus } from "@quanta/shell/stores/tab-bus";
import {
  Bot,
  BrainCircuit,
  Compass,
  FlaskConical,
  Gauge,
  GitMerge,
  History,
  Lock,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import "./analysis-catalog-page.css";

// ─── Domain metadata (icon + label + blurb) ───────────────────────────
type DomainMeta = {
  icon: ReactNode;
  label: string;
  blurb: string;
};

const iconOf = (
  Cmp: ComponentType<{ size?: number; strokeWidth?: number }>,
): ReactNode => <Cmp size={16} strokeWidth={1.6} />;

const DOMAIN_META: Record<InsightDomain, DomainMeta> = {
  "explore": {
    icon: iconOf(Compass),
    label: "Explore",
    blurb: "Where to start — entry points, repo tour, navigation aids.",
  },
  "productivity": {
    icon: iconOf(Gauge),
    label: "Productivity",
    blurb: "Personal and team velocity, flow state, decision throughput.",
  },
  "ai-agent": {
    icon: iconOf(Bot),
    label: "AI · Agent",
    blurb: "Trajectories, stuck patterns, orchestra and handoff visibility.",
  },
  "ai-context-model": {
    icon: iconOf(BrainCircuit),
    label: "AI · Context & Model",
    blurb: "Context rot, token economy, model routing and budget.",
  },
  "ai-trust-governance": {
    icon: iconOf(ShieldCheck),
    label: "AI · Trust & Governance",
    blurb: "Benchmarks, audit trails, firewall and policy visibility.",
  },
  "se-architecture": {
    icon: iconOf(Network),
    label: "SE · Architecture",
    blurb: "Repo shape, layers, boundaries, hotspots, dependency drift.",
  },
  "se-quality": {
    icon: iconOf(Sparkles),
    label: "SE · Quality",
    blurb: "Complexity, duplication, dead code, hygiene signals.",
  },
  "se-testing": {
    icon: iconOf(FlaskConical),
    label: "SE · Testing",
    blurb: "Coverage, test strength, readiness for merge.",
  },
  "se-refactor-change": {
    icon: iconOf(GitMerge),
    label: "SE · Refactor & Change",
    blurb: "Blast radius, behavior diff, migration and rollback risk.",
  },
  "se-security-supply-chain": {
    icon: iconOf(Lock),
    label: "SE · Security & Supply Chain",
    blurb: "Taint flow, injection, dependency risk, SBOM and secrets.",
  },
  "se-evolution": {
    icon: iconOf(History),
    label: "SE · Evolution",
    blurb: "Drift over time, churn, ownership shifts, long-range trends.",
  },
  "se-ownership-team": {
    icon: iconOf(Users),
    label: "SE · Ownership & Team",
    blurb: "Authors, domain knowledge, bus factor, review load.",
  },
};

const DOMAIN_ORDER: readonly InsightDomain[] = [
  "ai-trust-governance",
  "ai-agent",
  "ai-context-model",
  "productivity",
  "se-architecture",
  "se-quality",
  "se-testing",
  "se-refactor-change",
  "se-security-supply-chain",
  "se-evolution",
  "se-ownership-team",
  "explore",
];

// ─── Capability fingerprint (for the card thumbnail signal bars) ───────

const EVIDENCE_SCORE: Record<EvidenceClass, number> = {
  none: 10,
  weak: 38,
  strong: 72,
  auditable: 96,
};
const ACTIONABILITY_SCORE: Record<
  AnalysisCatalogRecord["taxonomy"]["signal"]["actionability"],
  number
> = {
  explain: 32,
  triage: 58,
  "direct-action": 92,
};
const DETERMINISM_SCORE: Record<
  AnalysisCatalogRecord["taxonomy"]["signal"]["determinism"],
  number
> = {
  heuristic: 28,
  bounded: 63,
  deterministic: 94,
};
const CONFIDENCE_SCORE: Record<
  AnalysisCatalogRecord["taxonomy"]["signal"]["confidence"],
  number
> = {
  heuristic: 34,
  estimated: 61,
  measured: 88,
};

function fingerprint(record: AnalysisCatalogRecord): readonly { label: string; score: number }[] {
  const evidence = record.decision.evidenceClass ?? record.taxonomy.signal.evidenceLevel;
  return [
    { label: "E", score: EVIDENCE_SCORE[evidence] },
    { label: "A", score: ACTIONABILITY_SCORE[record.taxonomy.signal.actionability] },
    { label: "D", score: DETERMINISM_SCORE[record.taxonomy.signal.determinism] },
    { label: "C", score: CONFIDENCE_SCORE[record.taxonomy.signal.confidence] },
  ] as const;
}

function gradeTone(grade: AnalysisCatalogRecord["decision"]["grade"]): string {
  switch (grade) {
    case "blocking":
    case "gating":
      return "danger";
    case "advisory":
    case "triage":
      return "warn";
    case "informational":
      return "muted";
    default:
      return "muted";
  }
}

function searchableText(record: AnalysisCatalogRecord): string {
  return [
    record.title,
    record.shortLabel,
    record.summary,
    record.tech,
    record.usecase,
    record.taxonomy.primary.domain,
    record.taxonomy.primary.scope,
    record.taxonomy.primary.intent,
    record.taxonomy.subdomain,
    ...(record.taxonomy.keywords ?? []),
    ...(record.decision.supports ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function openRecord(record: AnalysisCatalogRecord): void {
  primeUniverseLaunch({ mode: record.id });
  const label =
    record.launch.tabTitle ??
    `${DOMAIN_META[record.taxonomy.primary.domain].label} · ${record.shortLabel}`;
  tabBus.open("universe", label);
}

// ─── Page ──────────────────────────────────────────────────────────────

export function AnalysisCatalogPage() {
  const records = useMemo(() => listAnalysisCatalogRecords(), []);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => searchableText(r).includes(q));
  }, [query, records]);

  const grouped = useMemo(() => {
    const map = new Map<InsightDomain, AnalysisCatalogRecord[]>();
    for (const r of filtered) {
      const key = r.taxonomy.primary.domain;
      const bucket = map.get(key);
      if (bucket) bucket.push(r);
      else map.set(key, [r]);
    }
    return DOMAIN_ORDER
      .map((domain) => ({
        domain,
        meta: DOMAIN_META[domain],
        items: (map.get(domain) ?? []).slice().sort((a, b) => a.title.localeCompare(b.title)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filtered]);

  return (
    <div className="analysis-catalog">
      <header className="analysis-catalog__hero">
        <div className="analysis-catalog__kicker">Analysis capability graph</div>
        <h1 className="analysis-catalog__title">Every analysis capability, one tab away.</h1>
        <p className="analysis-catalog__sub">
          모든 분석 기능을 domain · scope · decision 기준으로 묶고, 카드 하나가 곧 탭 하나다.
          클릭하면 universe 탭이 해당 view-mode로 프라임된다.
        </p>
        <label className="analysis-catalog__search">
          <Search size={14} strokeWidth={1.8} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, technique, keyword, decision, or use case"
            aria-label="Search analysis capabilities"
          />
          {query && (
            <button
              type="button"
              className="analysis-catalog__search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </label>
      </header>

      {grouped.map((group) => (
        <section key={group.domain} aria-labelledby={`cat-${group.domain}`}>
          <div className="analysis-catalog__sectionbar">
            <span className="analysis-catalog__section-icon" aria-hidden>
              {group.meta.icon}
            </span>
            <div>
              <div id={`cat-${group.domain}`} className="analysis-catalog__section-title">
                {group.meta.label}
              </div>
              <div className="analysis-catalog__section-desc">{group.meta.blurb}</div>
            </div>
            <span className="analysis-catalog__section-spacer" />
            <span className="analysis-catalog__badge">
              {group.items.length} {group.items.length === 1 ? "capability" : "capabilities"}
            </span>
          </div>

          <div className="analysis-catalog__grid">
            {group.items.map((record) => (
              <CatalogCard key={record.id} record={record} domain={group.domain} />
            ))}
          </div>
        </section>
      ))}

      {grouped.length === 0 && (
        <div className="analysis-catalog__empty">
          <div className="analysis-catalog__empty-title">No matching capabilities</div>
          <p className="analysis-catalog__empty-sub">검색어를 넓혀서 다시 찾아봐.</p>
        </div>
      )}
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────

function CatalogCard({
  record,
  domain,
}: {
  record: AnalysisCatalogRecord;
  domain: InsightDomain;
}) {
  const bars = fingerprint(record);
  const tone = gradeTone(record.decision.grade);
  return (
    <button
      type="button"
      className="analysis-catalog__card"
      onClick={() => openRecord(record)}
    >
      <div className="analysis-catalog__card-head">
        <span className="analysis-catalog__card-glyph" aria-hidden>
          {record.glyph}
        </span>
        <span className="analysis-catalog__card-cat">{domain}</span>
        <span className="analysis-catalog__card-spacer" />
        <span className={`analysis-catalog__card-grade analysis-catalog__card-grade--${tone}`}>
          {record.decision.grade}
        </span>
      </div>
      <div className="analysis-catalog__card-title">{record.title}</div>
      <div className="analysis-catalog__card-blurb">{record.summary}</div>

      <div className="analysis-catalog__fingerprint" aria-hidden>
        {bars.map((b) => (
          <div key={b.label} className="analysis-catalog__fp-row">
            <span className="analysis-catalog__fp-label">{b.label}</span>
            <span className="analysis-catalog__fp-track">
              <span
                className="analysis-catalog__fp-fill"
                style={{ width: `${b.score}%` }}
              />
            </span>
          </div>
        ))}
      </div>

      <div className="analysis-catalog__card-foot">
        <span className="analysis-catalog__card-scope">
          {record.taxonomy.primary.scope} · {record.taxonomy.primary.intent}
        </span>
        <span className="analysis-catalog__card-open">Open →</span>
      </div>
    </button>
  );
}
