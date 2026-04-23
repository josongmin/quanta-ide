import { useMemo, useState } from "react";
import type { FeatureRecord } from "@quanta/shell/stores/feature-registry";
import { CATEGORIES } from "../../lib/home-picker.utils";

interface BrowseAllProps {
  allFeatures: FeatureRecord[];
  onBack: () => void;
  onRun: (feature: FeatureRecord) => void;
}

type BrowseChipKind =
  | "intent"
  | "scope"
  | "decision"
  | "evidence"
  | "action"
  | "category"
  | "meta";

type BrowseChipTone = "accent" | "muted" | "success" | "warn" | "default";

interface BrowseChip {
  kind: BrowseChipKind;
  label: string;
  tone?: BrowseChipTone;
  title?: string;
}

type LooseFeatureRecord = FeatureRecord & Record<string, unknown>;

interface BrowseFeatureView {
  feature: FeatureRecord;
  score: number;
  semanticChips: BrowseChip[];
  supportChips: BrowseChip[];
}

const CHIP_KIND_LABEL: Record<BrowseChipKind, string> = {
  intent: "Intent",
  scope: "Scope",
  decision: "Decision",
  evidence: "Evidence",
  action: "Action",
  category: "Category",
  meta: "Meta",
};

const CATEGORY_LABELS = new Map(CATEGORIES.map((category) => [category.id, category.label]));
const GROUP_ORDER = [
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
  ...CATEGORIES.map((category) => category.id),
];

const INTENT_FILTERS = ["explore", "explain", "diagnose", "decide", "verify", "optimize", "govern"] as const;
const SCOPE_FILTERS = ["repo", "package", "file", "symbol", "diff", "task", "agent-run", "model", "budget", "policy"] as const;
const DECISION_FILTERS = ["merge", "delegate", "route-model", "escalate-review", "policy-audit"] as const;

export function BrowseAll({ allFeatures, onBack, onRun }: BrowseAllProps) {
  const [query, setQuery] = useState("");
  const [intentFilter, setIntentFilter] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<string | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const grouped = useMemo(() => {
    const views = allFeatures
      .filter((feature) => matchesFacetFilters(feature, { intentFilter, scopeFilter, decisionFilter }))
      .map((feature): BrowseFeatureView | null => {
        const view = buildBrowseFeatureView(feature);
        const score = normalizedQuery.length > 0 ? scoreBrowseFeature(feature, view, normalizedQuery) : 0;
        if (normalizedQuery.length > 0 && score === Number.POSITIVE_INFINITY) return null;
        return { ...view, feature, score };
      })
      .filter((view): view is BrowseFeatureView => view !== null)
      .sort((a, b) => {
        if (normalizedQuery.length > 0 && a.score !== b.score) return a.score - b.score;
        return a.feature.title.localeCompare(b.feature.title);
      });

    const buckets = new Map<string, { id: string; label: string; items: BrowseFeatureView[] }>();
    for (const view of views) {
      const id = view.feature.analysis?.primary?.domain ?? view.feature.category;
      const bucket = buckets.get(id);
      if (bucket) bucket.items.push(view);
      else buckets.set(id, { id, label: labelForGroup(id), items: [view] });
    }

    return [...buckets.values()].sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a.id);
      const bi = GROUP_ORDER.indexOf(b.id);
      const ar = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const br = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      return ar - br || a.label.localeCompare(b.label);
    });
  }, [allFeatures, decisionFilter, intentFilter, normalizedQuery, scopeFilter]);

  const resultCount = grouped.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section className="hp__browse" aria-labelledby="hp-browse-title">
      <header className="hp__browse-head">
        <div className="hp__browse-headcopy">
          <div className="hp__browse-kicker">Feature catalog</div>
          <h3 id="hp-browse-title" className="hp__browse-title">
            All capabilities
          </h3>
          <p className="hp__browse-sub">
            Search by intent, scope, decision, evidence, action, command, tag, or category.
          </p>
        </div>
        <button type="button" className="hp__browse-back" onClick={onBack} aria-label="Back to home">
          ← back
        </button>
      </header>

      <label className="hp__search" aria-label="Search capabilities">
        <span aria-hidden className="hp__search-ico">
          ⌕
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by intent, scope, command, tag, or category"
        />
        <span className="hp__search-kbd" aria-label={`${resultCount} results`}>
          {resultCount}
        </span>
      </label>

      <div className="hp__browse-rails" aria-label="Catalog facet filters">
        <FacetRail label="Intent" values={INTENT_FILTERS} active={intentFilter} onToggle={setIntentFilter} />
        <FacetRail label="Scope" values={SCOPE_FILTERS} active={scopeFilter} onToggle={setScopeFilter} />
        <FacetRail label="Decision" values={DECISION_FILTERS} active={decisionFilter} onToggle={setDecisionFilter} />
      </div>

      {grouped.length === 0 ? (
        <div className="hp__browse-empty">
          <div className="hp__browse-empty-title">No matching capabilities</div>
          <p className="hp__browse-empty-sub">
            Try a broader intent, command title, feature tag, or category name.
          </p>
        </div>
      ) : (
        <div className="hp__browse-cats">
          {grouped.map(({ id, label, items }) => (
            <section key={id} className="hp__browse-cat" aria-labelledby={`hp-browse-cat-${id}`}>
              <header className="hp__browse-cat-head">
                <div>
                  <h4 id={`hp-browse-cat-${id}`} className="hp__browse-cat-label">
                    {label}
                  </h4>
                  <div className="hp__browse-cat-sub">
                    {items.length} capability{items.length === 1 ? "" : "ies"}
                  </div>
                </div>
                <span className="hp__browse-cat-count">{items.length}</span>
              </header>
              <div className="hp__browse-grid">
                {items.map((view) => (
                  <BrowseAllCard
                    key={view.feature.id}
                    feature={view.feature}
                    semanticChips={view.semanticChips}
                    supportChips={view.supportChips}
                    onRun={onRun}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}


function FacetRail({
  label,
  values,
  active,
  onToggle,
}: {
  label: string;
  values: readonly string[];
  active: string | null;
  onToggle: (value: string | null) => void;
}) {
  return (
    <div className="hp__facet-rail">
      <span className="hp__facet-label">{label}</span>
      <div className="hp__facet-values">
        {values.map((value) => {
          const selected = active === value;
          return (
            <button
              key={value}
              type="button"
              className={`hp__facet-chip${selected ? " hp__facet-chip--active" : ""}`}
              onClick={() => onToggle(selected ? null : value)}
              aria-pressed={selected}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BrowseAllCard({
  feature,
  semanticChips,
  supportChips,
  onRun,
}: {
  feature: FeatureRecord;
  semanticChips: BrowseChip[];
  supportChips: BrowseChip[];
  onRun: (feature: FeatureRecord) => void;
}) {
  const kbd = feature.commands?.[0]?.keybinding;
  const stateClass =
    feature.state === "disabled"
      ? "hp__cap-state--disabled"
      : feature.state === "error"
        ? "hp__cap-state--error"
        : "hp__cap-state--active";
  const ariaLabel = `${feature.title}. ${feature.description}`;

  return (
    <button
      type="button"
      className="hp__cap"
      onClick={() => onRun(feature)}
      title={ariaLabel}
      aria-label={feature.title}
    >
      <div className="hp__cap-top">
        <div className="hp__cap-text">
          <h5 className="hp__cap-title">{feature.title}</h5>
          <p className="hp__cap-desc">{feature.description}</p>
        </div>
        <div className="hp__cap-statebox">
          {feature.badge && (
            <span className={`hp__cap-badge hp__cap-badge--${feature.badge}`} title={`Badge: ${feature.badge}`}>
              {feature.badge}
            </span>
          )}
          <span className={`hp__cap-state ${stateClass}`}>
            <span className="hp__cap-dot" aria-hidden />
            {feature.state}
          </span>
        </div>
      </div>

      {semanticChips.length > 0 ? (
        <div className="hp__cap-chips" aria-label={`${feature.title} semantic summary`}>
          {semanticChips.map((chip) => (
            <BrowseChipPill key={`${chip.kind}:${chip.label}`} chip={chip} />
          ))}
        </div>
      ) : null}

      <div className="hp__cap-foot">
        <div className="hp__cap-chips hp__cap-chips--support" aria-label={`${feature.title} supporting metadata`}>
          {supportChips.map((chip) => (
            <BrowseChipPill key={`${chip.kind}:${chip.label}`} chip={chip} />
          ))}
        </div>
        {kbd ? <kbd className="hp__cap-kbd">{kbd}</kbd> : <span className="hp__cap-kbd hp__cap-kbd--muted">run</span>}
      </div>
    </button>
  );
}

function BrowseChipPill({ chip }: { chip: BrowseChip }) {
  return (
    <span
      className={`hp__chip hp__chip--${chip.kind}${chip.tone ? ` hp__chip--${chip.tone}` : ""}`}
      title={chip.title ?? chip.label}
    >
      <span className="hp__chip-kind">{CHIP_KIND_LABEL[chip.kind]}</span>
      <span className="hp__chip-label">{chip.label}</span>
    </span>
  );
}

function buildBrowseFeatureView(feature: FeatureRecord): Omit<BrowseFeatureView, "feature" | "score"> {
  const loose = feature as LooseFeatureRecord;
  const analysis = feature.analysis;
  const semanticChips: BrowseChip[] = [];

  pushRoleChips(semanticChips, "intent", "accent", [analysis?.primary?.intent, ...(analysis?.intents ?? [])], {
    title: feature.description,
    fallback: fallbackIntentLabel(feature),
  });
  pushRoleChips(semanticChips, "scope", "muted", [analysis?.primary?.scope, ...(analysis?.scopes ?? [])]);
  pushRoleChips(semanticChips, "decision", "warn", [analysis?.decisionGrade, ...(analysis?.decisionTargets ?? [])]);
  pushRoleChips(semanticChips, "evidence", "success", analysis?.evidenceClass);

  pushRoleChips(semanticChips, "intent", "accent", readField(loose, ["intent", "goal", "purpose", "why", "outcome", "problem", "theme"]), {
    title: feature.description,
    fallback: fallbackIntentLabel(feature),
  });
  pushRoleChips(semanticChips, "scope", "muted", readField(loose, ["scope", "facet", "primaryFacet", "surface", "area", "context", "target", "audience"]));
  pushRoleChips(semanticChips, "decision", "warn", readField(loose, ["decision", "choice", "policy", "strategy", "tradeoff", "mode"]));
  pushRoleChips(semanticChips, "evidence", "success", readField(loose, ["evidence", "signal", "proof", "metric", "source", "note"]));

  const actionSources: unknown[] = [
    analysis?.actions,
    readField(loose, ["action", "primaryAction", "nextAction"]),
    feature.primary?.tileLabel,
    feature.primary?.tileHint,
    ...(feature.commands ?? []),
  ];
  for (const source of actionSources) {
    pushChipValues(semanticChips, "action", "default", source);
  }
  dedupeChips(semanticChips);
  trimChips(semanticChips, 6);

  const supportChips: BrowseChip[] = [];
  pushChip(supportChips, {
    kind: "category",
    label: CATEGORY_LABELS.get(feature.category) ?? feature.category,
    tone: "muted",
  });
  if (analysis?.primary?.domain) {
    pushChip(supportChips, { kind: "category", label: analysis.primary.domain, tone: "accent" });
  }
  if (analysis?.maturity) {
    pushChip(supportChips, { kind: "meta", label: analysis.maturity, tone: analysis.maturity === "core" ? "success" : "muted" });
  }
  if (analysis?.hygieneDebt) {
    pushChip(supportChips, { kind: "meta", label: "hygiene debt", tone: "warn" });
  }
  if (feature.version) {
    pushChip(supportChips, { kind: "meta", label: `v${feature.version}`, tone: "muted" });
  }
  pushChip(supportChips, { kind: "meta", label: feature.state, tone: toneForState(feature.state) });
  if ((feature.dependsOn?.length ?? 0) > 0) {
    pushChip(supportChips, {
      kind: "meta",
      label: `depends on ${feature.dependsOn!.length}`,
      tone: "muted",
      title: feature.dependsOn!.join(", "),
    });
  }
  if (feature.commands && feature.commands.length > 0) {
    const command = feature.commands[0];
    pushChip(supportChips, {
      kind: "action",
      label: command.title,
      tone: "accent",
      title: command.description ?? command.keybinding ?? command.title,
    });
  }
  if (feature.primary) {
    pushChip(supportChips, {
      kind: "action",
      label: feature.primary.tileLabel,
      tone: "accent",
      title: feature.primary.tileHint ?? feature.primary.tileLabel,
    });
  }
  dedupeChips(supportChips);
  trimChips(supportChips, 5);

  return {
    semanticChips,
    supportChips,
  };
}

function scoreBrowseFeature(
  feature: FeatureRecord,
  view: Omit<BrowseFeatureView, "feature" | "score">,
  query: string,
): number {
  const candidates: Array<{ text: string; weight: number }> = [
    { text: feature.title, weight: 0 },
    { text: collectChipText(view.semanticChips.filter((chip) => chip.kind === "intent")), weight: 10 },
    { text: collectChipText(view.semanticChips.filter((chip) => chip.kind === "scope")), weight: 14 },
    { text: feature.description, weight: 20 },
    { text: collectChipText(view.semanticChips), weight: 30 },
    { text: collectChipText(view.supportChips), weight: 40 },
    { text: [feature.category, feature.badge, feature.version, feature.state].filter(Boolean).join(" "), weight: 50 },
    { text: feature.commands?.map((command) => [command.title, command.description, command.keybinding].filter(Boolean).join(" ")).join(" ") ?? "", weight: 60 },
    { text: feature.dependsOn?.join(" ") ?? "", weight: 70 },
  ];

  let best = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const score = scoreText(candidate.text, query, candidate.weight);
    if (score < best) best = score;
  }
  return best;
}

function scoreText(text: string, query: string, weight: number): number {
  const haystack = normalizeText(text).toLowerCase();
  const index = haystack.indexOf(query);
  if (index === -1) return Number.POSITIVE_INFINITY;
  const prefixBonus = haystack.startsWith(query) ? -200 : 0;
  return index * 10 + weight * 1000 + prefixBonus;
}

function collectChipText(chips: BrowseChip[]): string {
  return chips.map((chip) => chip.label).join(" ");
}

function fallbackIntentLabel(feature: FeatureRecord): string {
  const description = normalizeText(feature.description);
  if (description.length > 0) return shortenText(description, 54);
  return shortenText(feature.title, 54);
}

function pushRoleChips(
  chips: BrowseChip[],
  kind: Extract<BrowseChipKind, "intent" | "scope" | "decision" | "evidence" | "action">,
  tone: BrowseChipTone,
  source: unknown,
  options?: { title?: string; fallback?: string },
): void {
  pushChipValues(chips, kind, tone, source, options);
  if (kind === "intent" && chips.every((chip) => chip.kind !== "intent")) {
    pushChip(chips, {
      kind,
      label: options?.fallback ?? "Intent",
      tone,
      title: options?.title,
    });
  }
}

function pushChipValues(
  chips: BrowseChip[],
  kind: BrowseChipKind,
  tone: BrowseChipTone,
  source: unknown,
  options?: { title?: string; fallback?: string },
): void {
  for (const chip of normalizeChipValues(source, kind, tone, options)) {
    pushChip(chips, chip);
  }
}

function normalizeChipValues(
  source: unknown,
  kind: BrowseChipKind,
  tone: BrowseChipTone,
  options?: { title?: string; fallback?: string },
): BrowseChip[] {
  if (source === null || source === undefined || source === false) return [];
  if (Array.isArray(source)) {
    return source.flatMap((item) => normalizeChipValues(item, kind, tone, options));
  }
  if (typeof source === "string" || typeof source === "number" || typeof source === "boolean") {
    const label = shortenText(normalizeText(String(source)), 36);
    if (label.length === 0) return [];
    return [{ kind, label, tone, title: options?.title ?? label }];
  }
  if (typeof source !== "object") return [];

  const record = source as Record<string, unknown>;
  const label =
    firstString(record, ["label", "title", "name", "text", "value", "summary"]) ??
    formatStructuredChip(record);
  if (!label) return collectNestedChips(record, kind, tone, options);

  const title = firstString(record, ["description", "hint", "details"]) ?? options?.title;
  return [
    {
      kind,
      label: shortenText(normalizeText(label), 36),
      tone,
      title,
    },
  ];
}

function collectNestedChips(
  record: Record<string, unknown>,
  kind: BrowseChipKind,
  tone: BrowseChipTone,
  options?: { title?: string; fallback?: string },
): BrowseChip[] {
  const chips: BrowseChip[] = [];
  for (const value of Object.values(record)) {
    if (value === record) continue;
    if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
      chips.push(...normalizeChipValues(value, kind, tone, options));
    }
  }
  if (chips.length > 0) return chips;
  if (options?.fallback) return [{ kind, label: options.fallback, tone, title: options.title }];
  return [];
}

function formatStructuredChip(record: Record<string, unknown>): string | null {
  const kind = firstString(record, ["kind", "type", "role", "status"]);
  const label = firstString(record, ["label", "title", "name", "text", "value", "summary", "description"]);
  if (label && kind) return `${kind}: ${shortenText(normalizeText(label), 32)}`;
  if (label) return shortenText(normalizeText(label), 36);

  const version = firstString(record, ["version", "v"]);
  const count = firstNumber(record, ["count", "n", "total", "size"]);
  if (kind && count !== null) return `${kind} ${count}`;
  if (kind && version) return `${kind} ${version}`;
  if (version && count !== null) return `${version} · ${count}`;
  return kind ?? null;
}

function pushChip(chips: BrowseChip[], chip: BrowseChip): void {
  const key = `${chip.kind}:${chip.label}`;
  if (chips.some((item) => `${item.kind}:${item.label}` === key)) return;
  chips.push(chip);
}

function dedupeChips(chips: BrowseChip[]): void {
  const seen = new Set<string>();
  let idx = 0;
  while (idx < chips.length) {
    const key = `${chips[idx]!.kind}:${chips[idx]!.label}`;
    if (seen.has(key)) chips.splice(idx, 1);
    else {
      seen.add(key);
      idx += 1;
    }
  }
}

function trimChips(chips: BrowseChip[], maxLength: number): void {
  if (chips.length > maxLength) chips.length = maxLength;
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return normalizeText(value);
  }
  return null;
}

function firstNumber(record: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function readField(record: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
  }
  return undefined;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function shortenText(value: string, maxLength: number): string {
  const text = normalizeText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function toneForState(state: FeatureRecord["state"]): BrowseChipTone {
  if (state === "error") return "warn";
  if (state === "disabled") return "muted";
  return "success";
}

function labelForGroup(id: string): string {
  const category = CATEGORY_LABELS.get(id as never);
  if (category) return category;
  return id
    .split("-")
    .map((part) => part === "ai" ? "AI" : part === "se" ? "SE" : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function matchesFacetFilters(
  feature: FeatureRecord,
  filters: { intentFilter: string | null; scopeFilter: string | null; decisionFilter: string | null },
): boolean {
  const analysis = feature.analysis;
  if (!filters.intentFilter && !filters.scopeFilter && !filters.decisionFilter) return true;
  if (filters.intentFilter) {
    const intents = new Set([analysis?.primary?.intent, ...(analysis?.intents ?? [])].filter(Boolean));
    if (!intents.has(filters.intentFilter)) return false;
  }
  if (filters.scopeFilter) {
    const scopes = new Set([analysis?.primary?.scope, ...(analysis?.scopes ?? [])].filter(Boolean));
    if (!scopes.has(filters.scopeFilter)) return false;
  }
  if (filters.decisionFilter) {
    const decisions = new Set(analysis?.decisionTargets ?? []);
    if (!decisions.has(filters.decisionFilter)) return false;
  }
  return true;
}
