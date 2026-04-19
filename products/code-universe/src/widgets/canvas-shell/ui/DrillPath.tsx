import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "../../../entities/entity";
import { entityStore, useEntityState } from "../../../entities/entity";
import { DEFAULT_TIER_LADDER, tierStore } from "../../../entities/tier";

// DrillPath
// --------------------------------------------------------------------
// Shows the ancestor chain of the currently-selected entity as a
// clickable breadcrumb ("engine ▸ tier ▸ edge-rollup.ts"). Clicking
// a segment re-selects that ancestor AND flips the tier ladder to
// match its kind — the viewport's own fit-to-content effect then
// animates the camera onto it.
//
// Complements TierBreadcrumb: that one is the tier LADDER; this is
// the current SELECTION PATH. Together they give the user both
// coordinates — "how zoomed am I" + "where specifically am I".

const STYLE_ROOT: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  color: "#6b7280",
};

const STYLE_CRUMB: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "system-ui, sans-serif",
};

const STYLE_SEP: CSSProperties = {
  color: "#d1d5db",
  fontSize: 10,
};

function jumpTo(entity: Entity): void {
  const spec = DEFAULT_TIER_LADDER.find(t => t.visibleKind === entity.kind);
  entityStore.selectEntity(entity.id);
  if (spec) tierStore.jumpToTier(spec.name);
}

export function DrillPath(): ReactElement | null {
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const tree = useEntityState(s => s.tree);
  if (!selectedId || !tree) return null;

  // ancestorsOf returns leaf → root; reverse for breadcrumb reading order.
  const chain = [...tree.ancestorsOf(selectedId)].reverse();
  if (chain.length <= 1) return null;

  return (
    <div style={STYLE_ROOT} aria-label="Selection path">
      {chain.map((entity, i) => {
        const isLast = i === chain.length - 1;
        return (
          <span key={entity.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              style={{
                ...STYLE_CRUMB,
                color: isLast ? "#111827" : "#6366f1",
                fontWeight: isLast ? 600 : 500,
              }}
              onClick={() => jumpTo(entity)}
            >
              {entity.name || entity.kind}
            </button>
            {!isLast ? <span style={STYLE_SEP}>▸</span> : null}
          </span>
        );
      })}
    </div>
  );
}
