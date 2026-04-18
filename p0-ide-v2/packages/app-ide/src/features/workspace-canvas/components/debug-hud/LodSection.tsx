import { LOD_TIERS, getTierConfig, resolveEffectiveTier } from "@quanta/canvas-engine";
import { useInteractionStore } from "../../store/interaction-store";
import { useSceneStore } from "../../store/scene-store";
import { useViewportStore } from "../../store/viewport-store";
import { useSettingsStore, settingsStore, type ForceLod } from "../../store/settings-store";

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
  const forceLod = useSettingsStore(s => s.forceLod);

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
    ? `+${upDist.toFixed(3)} → up`
    : downDist >= 0
      ? `-${downDist.toFixed(3)} → down`
      : "in-band";

  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">lod</span>
        <span className="ws-debug__v ws-debug__v--hl">{lod}</span>

        <span className="ws-debug__k">effective</span>
        <span className="ws-debug__v">
          {effectiveTier}
          {effectiveTier !== lod && (
            <span style={{ opacity: 0.55, marginLeft: 4 }}>(fallback)</span>
          )}
        </span>

        <span className="ws-debug__k">renderer</span>
        <span className="ws-debug__v">{activeTierCfg.rendererKind}</span>

        <span className="ws-debug__k">tier band</span>
        <span className="ws-debug__v">
          {lodTierCfg.downThreshold.toFixed(3)} – {lodTierCfg.upThreshold.toFixed(3)}
        </span>

        <span className="ws-debug__k">next</span>
        <span className="ws-debug__v">{nearestLabel}</span>

        <span className="ws-debug__k">tier flags</span>
        <span className="ws-debug__v">
          {activeTierCfg.showEdges !== false ? "edges " : ""}
          {activeTierCfg.showLabels !== false ? "labels " : ""}
          {activeTierCfg.fallback ? `↘${activeTierCfg.fallback}` : ""}
        </span>
      </div>

      <div className="ws-debug__divider">force lod</div>
      <div className="ws-debug__lod">
        {LOD_CHOICES.map(v => {
          const isActive = v !== "auto" && v === effectiveTier;
          return (
            <button
              key={v}
              type="button"
              className={`ws-debug__chip${forceLod === v ? " is-on" : ""}`}
              onClick={() => settingsStore.setForceLod(v)}
              title={v === "auto" ? "follow viewport scale" : `${v}${isActive ? " · active" : ""}`}
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
