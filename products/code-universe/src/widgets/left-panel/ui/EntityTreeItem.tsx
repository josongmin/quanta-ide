import {
  cloneElement,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactElement,
} from "react";
import { pickFileIcon } from "@quanta/ui-kit/ui/icons";
import type { Entity, EntityTree } from "@quanta/canvas-engine";
import { entityStore, useEntityState } from "../../../entities/entity";
import { fileDisplayName, inferFileExt } from "../../../shared/lib/file-ext";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { expansionStore, useIsExpanded } from "../model/expansion-store";
import {
  IconBraces,
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconFolderOpen,
  IconFunction,
} from "../../../shared/ui/icons";

function KindIcon({ entity, expanded }: { entity: Entity; expanded: boolean }): ReactElement {
  switch (entity.kind) {
    case "universe":
    case "galaxy":
    case "street":
      return expanded ? <IconFolderOpen size={13} /> : <IconFolder size={13} />;
    case "building": {
      const ext = inferFileExt(entity.path, entity.name);
      const raw = pickFileIcon(entity.name + ext) as ReactElement<Record<string, unknown>>;
      return cloneElement(raw, {
        width: 13,
        height: 13,
        style: { display: "block" },
      });
    }
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
  const isSelected = useEntityState(s => s.interaction.selectedId === entity.id);
  const isAnchor = useEntityState(s => s.interaction.anchorId === entity.id);
  const isHovered = useEntityState(s => s.interaction.hoveredId === entity.id);
  const isHoveredAncestor = useEntityState(s => s.interaction.hoveredAncestorIds.has(entity.id));
  const hasChildren = entity.childIds.length > 0;
  const rowRef = useRef<HTMLDivElement | null>(null);
  const locateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll into view when the canvas makes us the focus. Runs on
  // both the transition *into* anchor/selected and on first mount
  // with an existing anchor — covers the "open a tab, land on the
  // anchor already set" case. `block: "nearest"` so we never yank
  // the page up / down unnecessarily.
  useEffect(() => {
    if (!isAnchor && !isSelected) return;
    rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isAnchor, isSelected]);

  useEffect(() => () => {
    if (locateTimerRef.current !== null) clearTimeout(locateTimerRef.current);
  }, []);

  const onClickRow = useCallback(() => {
    // Explorer click is now pure navigation — select the entity
    // (so Inspector + canvas highlight follow) and pan the camera to
    // its position, but do NOT filter the canvas or force a tier
    // jump. The scope filter was retired: a click reveals where an
    // entity *lives* on the map, not a reshaped subtree-only view.
    // Zoom is a separate axis controlled by pinch/wheel; the user
    // picks the reading distance, not the click target.
    entityStore.selectEntity(entity.id);
    entityStore.locateEntity(entity.id);
  }, [entity.id]);
  const onMouseEnter = useCallback(() => {
    entityStore.hoverEntity(entity.id);
    // After a short pause, ask the canvas to pan to this entity if it's
    // off-screen — "I want to see where this lives" without committing a
    // selection. Cancelled immediately on mouse-leave so quick sweeps
    // across the tree don't jitter the camera.
    locateTimerRef.current = setTimeout(() => {
      locateTimerRef.current = null;
      entityStore.locateEntity(entity.id);
    }, 350);
  }, [entity.id]);
  const onMouseLeave = useCallback(() => {
    if (locateTimerRef.current !== null) {
      clearTimeout(locateTimerRef.current);
      locateTimerRef.current = null;
    }
    const cur = entityStore.getState().interaction.hoveredId;
    if (cur === entity.id) entityStore.hoverEntity(null);
    // Always clear locate on leave so the same entity can be re-located
    // the next time the user pauses on it.
    entityStore.locateEntity(null);
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
            color: isHoveredAncestor && !expanded ? color.accent : color.text2,
            flexShrink: 0,
            transition: `color ${transition.fast}`,
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
          <KindIcon entity={entity} expanded={expanded} />
        </span>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
            letterSpacing: font.letter.tight,
          }}
        >
          {fileDisplayName(entity)}
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
