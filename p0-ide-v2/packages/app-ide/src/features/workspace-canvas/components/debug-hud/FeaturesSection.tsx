import { useMemo } from "react";
import {
  featuresByCategory,
  type FeatureCategory,
  type FeatureDescriptor,
} from "../../lib/feature-registry";
import {
  featureFlagsStore,
  useFeatureFlags,
} from "../../store/feature-flags-store";
import { ThemeChipRow } from "../ThemeSwitcher";

const CATEGORY_LABEL: Record<FeatureCategory, string> = {
  collab: "Collaboration",
  annotation: "Annotation",
  devmode: "Dev Mode",
  review: "Review flows",
  navigation: "Navigation",
  power: "Power tools",
  embeds: "Embeds",
  overlay: "Overlays",
  ai: "AI",
  temporal: "Temporal",
  "action-terrain": "Action terrain",
  experimental: "Experimental",
};

const CATEGORY_ORDER: readonly FeatureCategory[] = [
  "collab",
  "annotation",
  "devmode",
  "review",
  "navigation",
  "power",
  "embeds",
  "overlay",
  "ai",
  "temporal",
  "action-terrain",
  "experimental",
];

const MATURITY_COLOR = {
  stable: "#22c55e",
  beta: "#7dd3fc",
  experimental: "#f59e0b",
} as const;

export function FeaturesSection() {
  const flags = useFeatureFlags(s => s.flags);

  const groups = useMemo(() => {
    const byCategory = featuresByCategory();
    return CATEGORY_ORDER
      .map(cat => ({ category: cat, features: byCategory.get(cat) ?? [] }))
      .filter(g => g.features.length > 0);
  }, []);

  const total = Object.keys(flags).length;
  const enabled = Object.values(flags).filter(Boolean).length;

  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">enabled</span>
        <span className="ws-debug__v ws-debug__v--hl">
          {enabled} / {total}
        </span>
      </div>

      <div className="ws-debug__divider">
        presets
      </div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={() => featureFlagsStore.resetToDefaults()}
          title="Restore every feature to its default state"
        >
          defaults
        </button>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={() => {
            for (const cat of CATEGORY_ORDER) featureFlagsStore.enableCategory(cat, true);
          }}
          title="Enable every feature"
        >
          all on
        </button>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={() => {
            for (const cat of CATEGORY_ORDER) featureFlagsStore.enableCategory(cat, false);
          }}
          title="Disable every feature"
        >
          all off
        </button>
      </div>

      {groups.map(g => (
        <CategoryBlock key={g.category} category={g.category} features={g.features} flags={flags} />
      ))}

      <div className="ws-debug__divider">theme</div>
      <div className="ws-debug__lod" style={{ gap: 4 }}>
        <ThemeChipRow />
      </div>
    </>
  );
}

function CategoryBlock({
  category,
  features,
  flags,
}: {
  category: FeatureCategory;
  features: readonly FeatureDescriptor[];
  flags: Record<string, boolean>;
}) {
  const enabledCount = features.filter(f => flags[f.id]).length;
  const allOn = enabledCount === features.length;
  const allOff = enabledCount === 0;

  return (
    <>
      <div className="ws-debug__divider" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>{CATEGORY_LABEL[category]}</span>
        <span style={{ opacity: 0.6, fontSize: 9 }}>
          {enabledCount}/{features.length}
        </span>
        <button
          type="button"
          className="ws-debug__chip"
          style={{ marginLeft: "auto", fontSize: 9 }}
          onClick={() => featureFlagsStore.enableCategory(category, !allOn)}
          title={allOn ? "disable all" : "enable all"}
        >
          {allOn ? "all off" : allOff ? "all on" : "toggle"}
        </button>
      </div>
      {features.map(f => (
        <FeatureRow key={f.id} feature={f} enabled={!!flags[f.id]} />
      ))}
    </>
  );
}

function FeatureRow({ feature, enabled }: { feature: FeatureDescriptor; enabled: boolean }) {
  const depMissing = (feature.dependsOn ?? []).some(id => !featureFlagsStore.isEnabled(id));
  const effectivelyOn = enabled && !depMissing;

  return (
    <label
      className="ws-debug__row"
      title={`${feature.description}${feature.dependsOn ? `\n\nrequires: ${feature.dependsOn.join(", ")}` : ""}${feature.introducedIn ? `\nintroduced: ${feature.introducedIn}` : ""}`}
      style={{ opacity: depMissing ? 0.5 : 1 }}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={e => featureFlagsStore.setFlag(feature.id, e.target.checked)}
      />
      <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: MATURITY_COLOR[feature.maturity],
            flexShrink: 0,
          }}
          title={feature.maturity}
        />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {feature.label}
        </span>
        {!effectivelyOn && enabled && (
          <span style={{ fontSize: 9, color: "#f59e0b" }}>(dep off)</span>
        )}
      </span>
    </label>
  );
}
