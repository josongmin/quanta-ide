import { useMemo } from "react";
import {
  featuresByCategory,
  type FeatureCategory,
  type FeatureDescriptor,
} from "../../lib/feature-registry";
import {
  applyPreset,
  inferActivePreset,
  listPresets,
} from "../../lib/feature-presets";
import {
  featureFlagsStore,
  useFeatureFlags,
} from "../../store/feature-flags-store";
import { ThemeChipRow } from "../ThemeSwitcher";
import { toastStore } from "@quanta/shell/stores/toast-store";
import { ToggleRow } from "./ToggleRow";

const CATEGORY_LABEL: Record<FeatureCategory, string> = {
  collab: "협업",
  annotation: "주석",
  devmode: "개발자 모드",
  review: "리뷰 플로우",
  navigation: "탐색",
  power: "파워 도구",
  embeds: "임베드",
  overlay: "오버레이",
  ai: "AI",
  temporal: "시간 흐름",
  actionTerrain: "액션 지형",
  experimental: "실험적 기능",
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
  "actionTerrain",
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

  const presets = useMemo(() => listPresets(), []);
  // inferActivePreset reads the flags store; re-computed whenever `flags`
  // changes because we also select `flags` above (useSyncExternalStore
  // notifies on every flag edit).
  const activePreset = useMemo(() => inferActivePreset(), [flags]);

  const total = Object.keys(flags).length;
  const enabled = Object.values(flags).filter(Boolean).length;

  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">활성</span>
        <span className="ws-debug__v ws-debug__v--hl">
          {enabled} / {total}
        </span>
      </div>

      <div className="ws-debug__divider">
        퀵 프리셋
      </div>
      <div className="ws-debug__lod" style={{ gap: 2, flexWrap: "wrap" }}>
        {presets.map(p => (
          <button
            key={p.id}
            type="button"
            className={`ws-debug__chip${activePreset === p.id ? " is-on" : ""}`}
            onClick={() => {
              applyPreset(p.id);
              // 2s toast per U2 spec — shorter than default 4s.
              toastStore.push({
                kind: "info",
                title: `프리셋 적용: ${p.label}`,
                detail: p.description,
                ttlMs: 2000,
              });
            }}
            title={p.description}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="ws-debug__divider">
        프리셋
      </div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={() => featureFlagsStore.resetToDefaults()}
          title="모든 기능을 기본 상태로 복원"
        >
          기본값으로 초기화
        </button>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={() => {
            for (const cat of CATEGORY_ORDER) featureFlagsStore.enableCategory(cat, true);
          }}
          title="모든 기능 활성"
        >
          모두 켜기
        </button>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={() => {
            for (const cat of CATEGORY_ORDER) featureFlagsStore.enableCategory(cat, false);
          }}
          title="모든 기능 비활성"
        >
          모두 끄기
        </button>
      </div>

      {groups.map(g => (
        <CategoryBlock key={g.category} category={g.category} features={g.features} flags={flags} />
      ))}

      <div className="ws-debug__divider">테마</div>
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
          title={allOn ? "모두 비활성" : "모두 활성"}
        >
          {allOn ? "모두 끄기" : allOff ? "모두 켜기" : "토글"}
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
  const label = !depMissing || !enabled ? feature.label : `${feature.label} (의존성 꺼짐)`;

  return (
    <div
      title={`${feature.description}${feature.dependsOn ? `\n\n필요 기능: ${feature.dependsOn.join(", ")}` : ""}${feature.introducedIn ? `\n도입: ${feature.introducedIn}` : ""}`}
    >
      <ToggleRow
        label={label}
        checked={enabled}
        onChange={v => featureFlagsStore.setFlag(feature.id, v)}
        leading={
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: MATURITY_COLOR[feature.maturity],
            }}
            title={feature.maturity}
            aria-hidden
          />
        }
      />
    </div>
  );
}
