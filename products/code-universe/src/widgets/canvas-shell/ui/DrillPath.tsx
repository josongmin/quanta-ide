import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "../../../entities/entity";
import { entityStore, useEntityState } from "../../../entities/entity";
import { DEFAULT_TIER_LADDER, tierStore } from "../../../entities/tier";
import { color, font, radius, transition } from "../../../shared/ui/tokens";

// DrillPath — the ancestor chain for the currently-selected entity.
// Reads like a file path (workspace / shell / palette / CommandRow):
// muted grey with slash separators, the leaf segment bold in primary
// ink. Keeps the chain clickable so users can jump back up without
// leaving the canvas, but looks like prose instead of a toolbar so
// it doesn't compete with the tier / weight / kind controls.

const ROOT: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 0,
  fontFamily: font.mono,
  fontSize: font.size.sm,
  letterSpacing: font.letter.tight,
  color: color.text2,
  maxWidth: 440,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const CRUMB: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: "2px 4px",
  borderRadius: radius.sm,
  fontSize: font.size.sm,
  fontFamily: font.mono,
  letterSpacing: font.letter.tight,
  color: color.text1,
  cursor: "pointer",
  transition: `background ${transition.fast}, color ${transition.fast}`,
};

const CRUMB_LEAF: CSSProperties = {
  ...CRUMB,
  color: color.text0,
  fontWeight: font.weight.semibold,
  cursor: "default",
};

const SEP: CSSProperties = {
  color: color.text3,
  fontSize: font.size.sm,
  paddingInline: 2,
  userSelect: "none",
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
  const chain = [...tree.ancestorsOf(selectedId)].reverse();
  if (chain.length <= 1) return null;

  return (
    <nav style={ROOT} aria-label="Selection path">
      {chain.map((entity, i) => {
        const isLast = i === chain.length - 1;
        return (
          <span key={entity.id} style={{ display: "inline-flex", alignItems: "center" }}>
            <button
              type="button"
              style={isLast ? CRUMB_LEAF : CRUMB}
              onClick={isLast ? undefined : () => jumpTo(entity)}
              onMouseEnter={e => {
                if (!isLast) e.currentTarget.style.background = color.hover;
              }}
              onMouseLeave={e => {
                if (!isLast) e.currentTarget.style.background = "transparent";
              }}
            >
              {entity.name || entity.kind}
            </button>
            {!isLast ? <span style={SEP}>/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
