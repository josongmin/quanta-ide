import { useMemo, useState } from "react";
import type { ViewDescriptor, ViewMode } from "@quanta/code-universe";

interface Props {
  descriptors: readonly ViewDescriptor[];
  onPick: (id: ViewMode) => void;
}

const DOMAIN_LABEL: Record<string, string> = {
  "ai-agent":            "Agent runtime",
  "ai-context-model":    "Models · context · cost",
  "ai-trust-governance": "Trust · governance · compliance",
  "productivity":        "Tasks · throughput · ROI",
  "se-architecture":     "Architecture (policy)",
  "se-evolution":        "Evolution (diff-scoped)",
  "se-ownership-team":   "Team · ownership",
  "se-quality":          "Quality (diff)",
  "se-refactor-change":  "Refactor (diff)",
  "se-security-supply-chain": "Security (diff)",
  "se-testing":          "Testing (diff)",
  "explore":             "Other",
  "_other":              "Other",
};

const DOMAIN_ORDER: readonly string[] = [
  "ai-agent",
  "ai-context-model",
  "ai-trust-governance",
  "productivity",
  "se-evolution",
  "se-ownership-team",
  "se-architecture",
  "se-refactor-change",
  "se-quality",
  "se-testing",
  "se-security-supply-chain",
  "explore",
  "_other",
];

interface Group {
  key: string;
  descriptors: ViewDescriptor[];
}

export function AiOpsLauncher({ descriptors, onPick }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return descriptors;
    return descriptors.filter((d) => {
      const hay = `${d.id} ${d.label} ${d.hint} ${d.usecase} ${d.tech}`.toLowerCase();
      return hay.includes(q);
    });
  }, [descriptors, query]);

  const groups = useMemo<Group[]>(() => {
    const byDomain = new Map<string, ViewDescriptor[]>();
    for (const d of filtered) {
      const domain = d.taxonomy?.primary.domain ?? "_other";
      const list = byDomain.get(domain) ?? [];
      list.push(d);
      byDomain.set(domain, list);
    }
    const out: Group[] = [];
    for (const key of DOMAIN_ORDER) {
      const list = byDomain.get(key);
      if (list && list.length > 0) {
        out.push({ key, descriptors: list.sort((a, b) => a.order - b.order) });
      }
    }
    // Tail any domains not in DOMAIN_ORDER.
    for (const [key, list] of byDomain) {
      if (!DOMAIN_ORDER.includes(key)) {
        out.push({ key, descriptors: list.sort((a, b) => a.order - b.order) });
      }
    }
    return out;
  }, [filtered]);

  const totalCount = descriptors.length;
  const visibleCount = filtered.length;

  return (
    <div className="aiops">
      <header className="aiops__hero">
        <div className="aiops__hero-id">
          <span className="aiops__brand">AI Ops</span>
          <span className="aiops__hero-sep">·</span>
          <span className="aiops__hero-sub">runtime · models · budget · tasks · policy</span>
        </div>
        <div className="aiops__hero-meta">
          {visibleCount === totalCount
            ? `${totalCount} views`
            : `${visibleCount} / ${totalCount} views`}
          <br />
          <span className="aiops__hero-meta-sub">
            non-workspace 분석 — Code Universe와 분리됨
          </span>
        </div>
      </header>

      <div className="aiops__search">
        <input
          type="search"
          className="aiops__search-input"
          placeholder="Search runtime views — agent-trajectory, budget-console, model-router…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search runtime views"
        />
      </div>

      {groups.length === 0 ? (
        <div className="aiops__empty">no views match "{query}"</div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="aiops__group">
            <div className="aiops__group-h">
              <span>{DOMAIN_LABEL[group.key] ?? group.key}</span>
              <span className="aiops__group-count">{group.descriptors.length}</span>
            </div>
            <div className="aiops__cards">
              {group.descriptors.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="aiops__card"
                  onClick={() => onPick(d.id)}
                  aria-label={`Open ${d.label}`}
                >
                  <div className="aiops__card-h">
                    <span className="aiops__card-glyph" aria-hidden>{d.glyph}</span>
                    <span className="aiops__card-label">{d.label}</span>
                    <span className="aiops__card-id">{d.id}</span>
                  </div>
                  <p className="aiops__card-hint">{d.hint}</p>
                  <div className="aiops__card-meta">
                    {d.taxonomy?.primary.scope && (
                      <span className="aiops__chip">scope: {d.taxonomy.primary.scope}</span>
                    )}
                    {d.taxonomy?.primary.intent && (
                      <span className="aiops__chip">intent: {d.taxonomy.primary.intent}</span>
                    )}
                    {d.taxonomy?.maturity && (
                      <span className={`aiops__chip aiops__chip--${d.taxonomy.maturity}`}>
                        {d.taxonomy.maturity}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
