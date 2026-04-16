import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib";
import {
  LayoutGrid,
  Waypoints,
  SquarePen,
  ShieldCheck,
  Blocks,
  Workflow,
  Search,
} from "lucide-react";
import {
  featureRegistry,
  useFeatureRegistry,
  type FeatureCategory,
  type FeatureRecord,
  type SettingFieldContribution,
} from "@/shared/model/feature-registry";
import { toast } from "@/shared/model/toast-store";
import { HeroAsciiFlame } from "./HeroAsciiFlame";
import "./settings-page.css";

type CategoryId = FeatureCategory | "all";

const CATEGORY_LABEL: Record<FeatureCategory, string> = {
  intelligence: "Code intelligence",
  editing:      "Editing",
  rules:        "Rules & compliance",
  integration:  "Integrations",
  workflow:     "Workflow",
};

const NAV_ICON_SIZE = 15;
const NAV_ICON_STROKE = 1.5;

const CATEGORY_ICON: Record<FeatureCategory, ReactNode> = {
  intelligence: <Waypoints  size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />,
  editing:      <SquarePen  size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />,
  rules:        <ShieldCheck size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />,
  integration:  <Blocks     size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />,
  workflow:     <Workflow   size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />,
};

const ALL_ICON: ReactNode = <LayoutGrid size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />;

const SECTION_DESC: Record<FeatureCategory, string> = {
  intelligence: "Code intelligence signals — risk, blast, taint, behavior, incidents.",
  editing:      "Editor-side overlays, hovers, and symbol tooling.",
  rules:        "Rule authoring, compliance verification, and evidence tokens.",
  integration:  "External integrations, firewall, and runtime tools.",
  workflow:     "Reviews, scenarios, tasks, and end-to-end flows.",
};

type NavGroup = { id: string; label: string; items: FeatureCategory[] };

const NAV_GROUPS: NavGroup[] = [
  { id: "signals",   label: "Signals",   items: ["intelligence"] },
  { id: "authoring", label: "Authoring", items: ["editing", "rules"] },
  { id: "delivery",  label: "Delivery",  items: ["integration", "workflow"] },
];

export function SettingsPage() {
  const featuresMap = useFeatureRegistry((s) => s.features);
  const features = useMemo(() => [...featuresMap.values()], [featuresMap]);
  const [selected, setSelected] = useState<CategoryId>("all");
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>(() => seedValues(features));

  const userFeatures = useMemo(
    () => features.filter((f) => f.visibility === "user"),
    [features],
  );

  const counts = useMemo(() => {
    const map: Record<CategoryId, number> = {
      all: userFeatures.length,
      intelligence: 0,
      editing: 0,
      rules: 0,
      integration: 0,
      workflow: 0,
    };
    for (const f of userFeatures) map[f.category] += 1;
    return map;
  }, [userFeatures]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const visible = useMemo(() => {
    let list = userFeatures;
    if (searching) {
      list = list.filter((f) => {
        if (f.title.toLowerCase().includes(q)) return true;
        if (f.description.toLowerCase().includes(q)) return true;
        return f.settings?.some((s) => s.label.toLowerCase().includes(q) || s.key.toLowerCase().includes(q)) ?? false;
      });
    } else if (selected !== "all") {
      list = list.filter((f) => f.category === selected);
    }
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }, [userFeatures, selected, q, searching]);

  function updateValue(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function resetAll() {
    setValues(seedValues(features));
    toast.info("Settings reset", "all fields restored to defaults", "settings");
  }

  const titleLabel = searching
    ? "Search results"
    : selected === "all" ? "All features" : CATEGORY_LABEL[selected];
  const titleDesc = searching
    ? `Matching “${query.trim()}” across all registered features.`
    : selected === "all"
      ? "Every registered capability in the IDE — toggle, configure, or inspect its commands."
      : SECTION_DESC[selected];

  return (
    <div className="settings-page">
      <div className="settings-shell">
        <header className="settings-hero">
          <HeroAsciiFlame />
          <div className="settings-hero__content">
            <div className="settings-hero__kicker">
              Feature Control Plane
            </div>

            <h1 className="settings-hero__title">
              Configure, extend, <span className="settings-hero__accent">govern.</span>
            </h1>
            <p className="settings-hero__sub">
              One registry. Every capability in the IDE surfaces here, with its commands, settings, and dependencies.
            </p>
          </div>
        </header>

        <div className="settings-topbar" role="search">
          <Search className="settings-topbar__icon" size={18} strokeWidth={2} aria-hidden />
          <input
            type="search"
            className="settings-topbar__input"
            placeholder="Search every feature, setting, or key across the IDE…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Global settings search"
          />
          {query ? (
            <button
              type="button"
              className="settings-topbar__clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : (
            <kbd className="settings-topbar__kbd">⌘ K</kbd>
          )}
        </div>

        <div className="settings-body">
          <aside className="settings-nav">
           <div className="settings-nav__sticky">
            <nav className="settings-nav__list" role="tablist" aria-label="Setting categories">
              <div className="settings-nav__group">
                <div className="settings-nav__section">Workspace</div>
                <CategoryLink
                  id="all"
                  label="All features"
                  icon={ALL_ICON}
                  count={counts.all}
                  selected={selected === "all"}
                  onSelect={() => setSelected("all")}
                />
              </div>
              {NAV_GROUPS.map((group) => (
                <div key={group.id} className="settings-nav__group">
                  <div className="settings-nav__section">{group.label}</div>
                  {group.items.map((c) => (
                    <CategoryLink
                      key={c}
                      id={c}
                      label={CATEGORY_LABEL[c]}
                      icon={CATEGORY_ICON[c]}
                      count={counts[c]}
                      selected={selected === c}
                      onSelect={() => setSelected(c)}
                    />
                  ))}
                </div>
              ))}
            </nav>

            <div className="settings-nav__foot">
              <button type="button" className="settings-nav__reset" onClick={resetAll}>
                Reset all to defaults
              </button>
            </div>
           </div>
          </aside>

          <main className="settings-main">
            <header className="settings-title">
              <div className="settings-title__text">
                <div className="settings-title__row">
                  <h2 className="settings-title__h">{titleLabel}</h2>
                  <span className="settings-title__count">{visible.length}</span>
                </div>
                <p className="settings-title__desc">{titleDesc}</p>
              </div>
            </header>

            {visible.length === 0 ? (
              <EmptyState query={query} />
            ) : (
              <ul className="settings-feature-list">
                {visible.map((f) => (
                  <FeatureCard
                    key={f.id}
                    feature={f}
                    values={values}
                    onChange={updateValue}
                  />
                ))}
              </ul>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function seedValues(features: FeatureRecord[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of features) {
    for (const s of f.settings ?? []) {
      values[s.key] = s.default;
    }
  }
  return values;
}

function CategoryLink({
  id,
  label,
  icon,
  count,
  selected,
  onSelect,
}: {
  id: CategoryId;
  label: string;
  icon: ReactNode;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={cn("settings-nav__item", selected && "is-selected")}
      onClick={onSelect}
      data-id={id}
    >
      <span className="settings-nav__icon" aria-hidden>{icon}</span>
      <span className="settings-nav__label">{label}</span>
      <span className="settings-nav__count">{count}</span>
    </button>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="settings-empty">
      <div className="settings-empty__icon" aria-hidden>⌕</div>
      <div className="settings-empty__title">
        {query ? `No settings match “${query}”` : "No features in this category"}
      </div>
      <div className="settings-empty__hint">
        Features and their settings are registered through the Feature Registry.
      </div>
    </div>
  );
}

function FeatureCard({
  feature,
  values,
  onChange,
}: {
  feature: FeatureRecord;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const hasSettings = (feature.settings?.length ?? 0) > 0;
  const [disabled, setDisabled] = useState(feature.state !== "active");

  function toggleFeatureState() {
    const next = !disabled;
    setDisabled(next);
    featureRegistry.setState(feature.id, next ? "disabled" : "active");
    toast.info(
      `${feature.title} ${next ? "disabled" : "enabled"}`,
      feature.description,
      "settings",
    );
  }

  return (
    <li className={cn("settings-card", disabled && "is-disabled")} data-feature={feature.id}>
      <header className="settings-card__h">
        <div className="settings-card__title-col">
          <div className="settings-card__title-row">
            <h3 className="settings-card__title">{feature.title}</h3>
            {feature.badge && (
              <span className={`settings-card__badge settings-card__badge--${feature.badge}`}>
                {feature.badge}
              </span>
            )}
            <span className="settings-card__version">v{feature.version}</span>
          </div>
          <p className="settings-card__desc">{feature.description}</p>
          {feature.dependsOn && feature.dependsOn.length > 0 && (
            <div className="settings-card__deps">
              <span className="settings-card__deps-k">depends on</span>
              {feature.dependsOn.map((d) => (
                <span key={d} className="settings-card__dep">{d}</span>
              ))}
            </div>
          )}
        </div>
        <div className="settings-card__aside">
          <span className={`settings-card__state settings-card__state--${disabled ? "disabled" : feature.state}`}>
            <span className="settings-card__state-dot" aria-hidden />
            {disabled ? "disabled" : feature.state}
          </span>
          <label className="settings-card__toggle">
            <input
              type="checkbox"
              checked={!disabled}
              onChange={toggleFeatureState}
              aria-label={`Enable ${feature.title}`}
            />
            <span className="settings-card__toggle-track" aria-hidden />
          </label>
        </div>
      </header>

      {hasSettings && (
        <ul className="settings-fields">
          {feature.settings!.map((field) => (
            <SettingField
              key={field.key}
              field={field}
              value={values[field.key]}
              disabled={disabled}
              onChange={(v) => onChange(field.key, v)}
            />
          ))}
        </ul>
      )}

      {feature.commands && feature.commands.length > 0 && (
        <div className="settings-card__commands">
          <span className="settings-card__commands-label">Commands</span>
          <div className="settings-card__commands-list">
            {feature.commands.map((c) => (
              <span key={c.id} className="settings-card__command" title={c.description}>
                <span className="settings-card__command-title">{c.title}</span>
                {c.keybinding && <kbd className="settings-card__kbd">{c.keybinding}</kbd>}
              </span>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

function SettingField({
  field,
  value,
  disabled,
  onChange,
}: {
  field: SettingFieldContribution;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  return (
    <li className={cn(`settings-field settings-field--${field.type}`, disabled && "is-disabled")}>
      <div className="settings-field__text">
        <span className="settings-field__label">{field.label}</span>
        {field.description && <span className="settings-field__desc">{field.description}</span>}
        <span className="settings-field__key">{field.key}</span>
      </div>
      <div className="settings-field__control">
        {field.type === "boolean" && (
          <label className="settings-field__toggle">
            <input
              type="checkbox"
              checked={Boolean(value)}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="settings-field__toggle-track" aria-hidden />
          </label>
        )}
        {field.type === "string" && (
          <input
            type="text"
            className="settings-field__input"
            value={String(value ?? "")}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {field.type === "number" && (
          <input
            type="number"
            className="settings-field__input settings-field__input--num"
            value={Number(value ?? 0)}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        )}
        {field.type === "enum" && field.enumValues && (
          <select
            className="settings-field__select"
            value={String(value ?? field.default)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          >
            {field.enumValues.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}
      </div>
    </li>
  );
}
