import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactElement,
} from "react";
import type { Entity, EntityKind, EntityTree } from "@quanta/canvas-engine";
import { entityStore, useEntityState } from "../../../entities/entity";
import { DEFAULT_TIER_LADDER, tierStore } from "../../../entities/tier";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { expansionStore, useIsExpanded } from "../model/expansion-store";
import {
  IconBraces,
  IconChevronDown,
  IconChevronRight,
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconFunction,
} from "../../../shared/ui/icons";

function KindIcon({ kind, expanded }: { kind: EntityKind; expanded: boolean }): ReactElement {
  switch (kind) {
    case "universe":
    case "galaxy":
    case "street":
      return expanded ? <IconFolderOpen size={13} /> : <IconFolder size={13} />;
    case "building":
      return <IconFile size={13} />;
    case "floor":
      return <IconBraces size={13} />;
    case "room":
      return <IconFunction size={13} />;
  }
}

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
  const expanded = useIsExpanded(entity.id);
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const anchorId = useEntityState(s => s.interaction.anchorId);
  const hoveredId = useEntityState(s => s.interaction.hoveredId);
  const isSelected = selectedId === entity.id;
  const isAnchor = anchorId === entity.id;
  const isHovered = hoveredId === entity.id;
  const hasChildren = entity.childIds.length > 0;
  const rowRef = useRef<HTMLDivElement | null>(null);

  // Scroll into view when the canvas makes us the focus. Runs on
  // both the transition *into* anchor/selected and on first mount
  // with an existing anchor — covers the "open a tab, land on the
  // anchor already set" case. `block: "nearest"` so we never yank
  // the page up / down unnecessarily.
  useEffect(() => {
    if (!isAnchor && !isSelected) return;
    rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isAnchor, isSelected]);

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
    expansionStore.toggle(entity.id);
  }, [entity.id]);

  const bg =
    isSelected ? color.selected
    : isAnchor ? color.bg3
    : isHovered ? color.hover
    : "transparent";
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[1],
    height: ROW_H,
    paddingLeft: depth * INDENT + 8,
    paddingRight: 10,
    marginInline: 4,
    borderRadius: radius.sm,
    fontSize: font.size.md,
    fontFamily: font.family,
    fontWeight: isSelected || isAnchor ? font.weight.medium : font.weight.regular,
    color: color.text0,
    background: bg,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    overflow: "hidden",
    transition: `background ${transition.fast}, color ${transition.fast}`,
  };

  return (
    <>
      <div
        ref={rowRef}
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
            width: 14,
            height: 14,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: color.text2,
            flexShrink: 0,
          }}
        >
          <KindIcon kind={entity.kind} expanded={expanded} />
        </span>
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
              color: color.text2,
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
