import { useCallback, useState, type CSSProperties, type ReactElement } from "react";
import type { Entity, EntityTree } from "@quanta/canvas-engine";
import { entityStore, useEntityState } from "../../../entities/entity";
import { DEFAULT_TIER_LADDER, tierStore } from "../../../entities/tier";
import { color, font, kindColor, radius, space, transition } from "../../../shared/ui/tokens";
import { IconChevronDown, IconChevronRight } from "../../../shared/ui/icons";

// EntityTreeItem — one recursive row in the Explorer tree.
// Expanded children mount lazily so an 80k-entity universe costs the
// tree nothing until the user drills in. Rows stay 24-px and use the
// shared token palette so the visual rhythm matches Inspector +
// activity rail.

const INDENT = 14;
const ROW_H = 26;

interface Props {
  entity: Entity;
  tree: EntityTree;
  depth: number;
}

export function EntityTreeItem({ entity, tree, depth }: Props): ReactElement {
  const [expanded, setExpanded] = useState(depth < 1);
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const hoveredId = useEntityState(s => s.interaction.hoveredId);
  const isSelected = selectedId === entity.id;
  const isHovered = hoveredId === entity.id;
  const hasChildren = entity.childIds.length > 0;

  const onClickRow = useCallback(() => {
    // Explorer click is a deliberate navigation — treat it like a
    // drill-in. `setAnchor` commits the scope, moves selection, and
    // flips focus on so the canvas narrows to this entity's
    // dependencies (same-tier) or its subtree (higher-tier anchor).
    // Packages / folders work as overview slots: clicking a galaxy
    // puts the anchor there and the canvas shows "everything under
    // this package", replacing the old fixed-tier overview without
    // losing the bird's-eye mode.
    entityStore.setAnchor(entity.id);
    const spec = DEFAULT_TIER_LADDER.find(t => t.visibleKind === entity.kind);
    if (spec) tierStore.jumpToTier(spec.name);
  }, [entity.id, entity.kind]);
  const onMouseEnter = useCallback(() => entityStore.hoverEntity(entity.id), [entity.id]);
  const onMouseLeave = useCallback(() => {
    const cur = entityStore.getState().interaction.hoveredId;
    if (cur === entity.id) entityStore.hoverEntity(null);
  }, [entity.id]);
  const onToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(v => !v);
  }, []);

  const dotColor = kindColor[entity.kind];
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[1],
    height: ROW_H,
    paddingLeft: depth * INDENT + 8,
    paddingRight: 10,
    marginInline: 4,
    borderRadius: radius.md,
    fontSize: font.size.md,
    fontFamily: font.family,
    fontWeight: isSelected ? font.weight.medium : font.weight.regular,
    color: isSelected ? color.accent : color.text0,
    background: isSelected ? color.accentSoft : isHovered ? color.hover : "transparent",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    overflow: "hidden",
    transition: `background ${transition.fast}, color ${transition.fast}`,
  };

  return (
    <>
      <div
        style={rowStyle}
        onClick={onClickRow}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? expanded : undefined}
        title={entity.path}
      >
        <span
          style={{
            width: 14,
            height: 14,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: color.text2,
            flexShrink: 0,
          }}
          onClick={hasChildren ? onToggle : undefined}
        >
          {hasChildren ? (
            expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />
          ) : null}
        </span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: radius.pill,
            background: dotColor,
            flexShrink: 0,
            boxShadow: isSelected ? `0 0 0 3px ${color.accentSofter}` : undefined,
            transition: `box-shadow ${transition.fast}`,
          }}
        />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
            letterSpacing: font.letter.tight,
          }}
        >
          {entity.name}
        </span>
        {entity.metrics?.loc !== undefined && entity.metrics.loc > 0 ? (
          <span
            style={{
              fontSize: font.size.xs,
              color: isSelected ? color.accent : color.text2,
              fontVariantNumeric: "tabular-nums",
              fontWeight: font.weight.medium,
              opacity: 0.9,
            }}
          >
            {entity.metrics.loc}
          </span>
        ) : null}
      </div>
      {expanded && hasChildren
        ? entity.childIds.map(id => {
            const child = tree.byId.get(id);
            if (!child) return null;
            return (
              <EntityTreeItem key={id} entity={child} tree={tree} depth={depth + 1} />
            );
          })
        : null}
    </>
  );
}
