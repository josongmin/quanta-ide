import { getTierConfig, resolveEffectiveTier } from "@quanta/canvas-engine";
import { useInteractionStore } from "../../store/interaction-store";
import { useSceneStore } from "../../store/scene-store";
import { useViewportStore } from "../../store/viewport-store";
import { useDebugSettings, debugSettingsStore, type ForceLod } from "../../store/debug-settings-store";

const LOD_CHOICES: readonly ForceLod[] = [
  "auto", "universe", "supergalaxy", "galaxy", "city", "street", "ground",
] as const;

// Short labels used on the force-LOD chips. Kept colocated so the map stays
// near the choice list — the full tier names are long and the chips are tight.
const LOD_SHORT: Record<ForceLod, string> = {
  auto: "auto",
  universe: "uni",
  supergalaxy: "sup",
  galaxy: "gal",
  city: "cty",
  street: "str",
  ground: "grd",
};

export function LodSection() {
  const lod = useInteractionStore(s => s.lod);
  const scale = useViewportStore(s => s.viewport.scale);
  const clusterTotal = useSceneStore(s => s.layout?.clusters?.length ?? 0);
  const superTotal = useSceneStore(s => s.layout?.superclusters?.length ?? 0);
  const forceLod = useDebugSettings(s => s.forceLod);

  const effectiveTier = resolveEffectiveTier(lod, {
    hasClusters: clusterTotal > 0,
    hasSuperclusters: superTotal > 0,
  });
  const activeTierCfg = getTierConfig(effectiveTier);
  const lodTierCfg = getTierConfig(lod);

  // Distance to next transition — helpful for predicting when the tier will flip.
  const upDist = lodTierCfg.upThreshold - scale;
  const downDist = scale - lodTierCfg.downThreshold;
  const nearestLabel = upDist >= 0 && upDist < downDist
    ? `+${upDist.toFixed(3)} → 상향`
    : downDist >= 0
      ? `-${downDist.toFixed(3)} → 하향`
      : "범위 내";

  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">LOD</span>
        <span className="ws-debug__v ws-debug__v--hl">{lod}</span>

        <span className="ws-debug__k">실효 단계</span>
        <span className="ws-debug__v">
          {effectiveTier}
          {effectiveTier !== lod && (
            <span style={{ opacity: 0.55, marginLeft: 4 }}>(대체)</span>
          )}
        </span>

        <span className="ws-debug__k">렌더러</span>
        <span className="ws-debug__v">{activeTierCfg.rendererKind}</span>

        <span className="ws-debug__k">단계 범위</span>
        <span className="ws-debug__v">
          {lodTierCfg.downThreshold.toFixed(3)} – {lodTierCfg.upThreshold.toFixed(3)}
        </span>

        <span className="ws-debug__k">다음 전환</span>
        <span className="ws-debug__v">{nearestLabel}</span>

        <span className="ws-debug__k">단계 플래그</span>
        <span className="ws-debug__v">
          {activeTierCfg.showEdges !== false ? "엣지 " : ""}
          {activeTierCfg.showLabels !== false ? "라벨 " : ""}
          {activeTierCfg.fallback ? `↘${activeTierCfg.fallback}` : ""}
        </span>
      </div>

      <div className="ws-debug__divider">LOD 강제</div>
      <div className="ws-debug__lod">
        {LOD_CHOICES.map(v => {
          const isActive = v !== "auto" && v === effectiveTier;
          return (
            <button
              key={v}
              type="button"
              className={`ws-debug__chip${forceLod === v ? " is-on" : ""}`}
              onClick={() => debugSettingsStore.setForceLod(v)}
              title={v === "auto" ? "뷰포트 스케일 따라감" : `${v}${isActive ? " · 활성" : ""}`}
            >
              {isActive && <span style={{ marginRight: 3 }}>●</span>}
              {LOD_SHORT[v]}
            </button>
          );
        })}
      </div>
    </>
  );
}
