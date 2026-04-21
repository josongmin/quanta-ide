import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import type {
  Entity,
  EntityTree,
  HierarchicalLayout,
} from "@quanta/canvas-engine";
import type { TierSpec } from "../../../entities/tier";
import type { CameraState } from "../../../shared/lib/camera-animation";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { useFileSource } from "../model/store";
import { SourceEditor } from "./SourceEditor";

// SourceOverlay — DOM layer of CodeMirror cards over the Pixi scene.
// --------------------------------------------------------------------
// Active any time the user is drilled to a file or deeper
// (`building`, `floor`, `room`). We iterate every building in the
// tree — not just `visibleEntities` — because at floor / room tier
// the tier filter hides buildings by design, but the file the user
// is zoomed into is still the thing we want to show source for.
//
// Design axes:
//   - Positioning: screen-space `left/top/width/height` recomputed per
//     camera frame. Content stays at 1:1 screen px for sharp text.
//   - Culling: viewport-AABB intersection + min-size gate + hard cap
//     on the number of live editors.
//   - Event isolation: wheel / pointerdown stop at the card boundary
//     so the pan/zoom gestures on the canvas don't fight the editor.
//   - Chrome: rectangle, no border-radius — cards read as code panes
//     flush to the canvas grid, not floating chiclets.

const MIN_SCREEN_W = 220;
const MIN_SCREEN_H = 140;
const MAX_LIVE_EDITORS = 16;

const DRILLED_KINDS = new Set<Entity["kind"]>(["building", "floor", "room"]);

export interface SourceOverlayProps {
  tree: EntityTree;
  layout: HierarchicalLayout;
  camera: CameraState;
  tier: TierSpec;
  viewportWidth: number;
  viewportHeight: number;
  selectedId: string | null;
  onSelect?: (id: string) => void;
}

interface PlacedCard {
  id: string;
  entity: Entity;
  left: number;
  top: number;
  width: number;
  height: number;
  area: number;
}

export function SourceOverlay(props: SourceOverlayProps): ReactElement | null {
  const {
    tree,
    layout,
    camera,
    tier,
    viewportWidth,
    viewportHeight,
    selectedId,
    onSelect,
  } = props;

  const placed = useMemo<readonly PlacedCard[]>(() => {
    if (!DRILLED_KINDS.has(tier.visibleKind)) return [];
    const vw = viewportWidth;
    const vh = viewportHeight;
    if (vw <= 0 || vh <= 0) return [];

    const out: PlacedCard[] = [];
    for (const e of tree.byKind("building")) {
      const rect = layout.rects.get(e.id);
      if (!rect) continue;
      const left = rect.x * camera.scale + camera.tx;
      const top = rect.y * camera.scale + camera.ty;
      const width = rect.w * camera.scale;
      const height = rect.h * camera.scale;

      if (width < MIN_SCREEN_W || height < MIN_SCREEN_H) continue;
      if (left + width < 0 || left > vw) continue;
      if (top + height < 0 || top > vh) continue;

      out.push({ id: e.id, entity: e, left, top, width, height, area: width * height });
    }

    // Largest card wins when we're over the cap — that's the one the
    // camera is centered on. Selected file pins itself to the list.
    out.sort((a, b) => b.area - a.area);
    const selected = out.findIndex(p => p.id === selectedId);
    if (selected > 0 && selected >= MAX_LIVE_EDITORS) {
      const [pick] = out.splice(selected, 1);
      out.unshift(pick);
    }
    if (out.length > MAX_LIVE_EDITORS) out.length = MAX_LIVE_EDITORS;
    return out;
  }, [
    tree,
    layout,
    camera.tx,
    camera.ty,
    camera.scale,
    tier.visibleKind,
    viewportWidth,
    viewportHeight,
    selectedId,
  ]);

  if (placed.length === 0) return null;

  return (
    <div style={ROOT_STYLE}>
      {placed.map(card => (
        <SourceCard
          key={card.id}
          card={card}
          selected={card.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function SourceCard({
  card,
  selected,
  onSelect,
}: {
  card: PlacedCard;
  selected: boolean;
  onSelect?: (id: string) => void;
}): ReactElement {
  const entry = useFileSource(card.entity.path);
  const [editing, setEditing] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Exit editing mode on click outside the card or Escape. Inside-card
  // wheel / pointer / keyboard stays local — stopPropagation on the
  // card takes care of pan/zoom bleed, and native CM listeners get
  // the events they need.
  useEffect(() => {
    if (!editing) return;
    const onMouseDown = (e: MouseEvent) => {
      const root = cardRef.current;
      if (root && !root.contains(e.target as Node)) setEditing(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditing(false);
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [editing]);

  const enterEditing = useCallback(() => setEditing(true), []);

  // When editing = false the whole card sits at `pointer-events: none`
  // so wheel / pointerdown fall through to the Pixi canvas — pan,
  // zoom, drill all keep working over the source pane. The header
  // chip is the one pointer-activatable surface (overridden to
  // `auto`) so users have a way to opt IN to editing mode without
  // having to guess.
  const style: CSSProperties = {
    position: "absolute",
    left: card.left,
    top: card.top,
    width: card.width,
    height: card.height,
    background: color.bg1,
    border: `1px solid ${editing ? color.text2 : selected ? color.borderStrong : color.border}`,
    borderRadius: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    pointerEvents: editing ? "auto" : "none",
    willChange: "transform",
    transition: `border-color ${transition.fast}`,
  };

  const header: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[2],
    padding: `${space[1]}px ${space[3]}px`,
    borderBottom: `1px solid ${color.border}`,
    background: editing ? color.bg3 : color.bg2,
    fontFamily: font.mono,
    fontSize: font.size.sm,
    color: color.text1,
    flexShrink: 0,
    userSelect: "none",
    // Header stays interactive so the user has a handle to toggle
    // editing even when the card body is pass-through.
    pointerEvents: "auto",
    cursor: "pointer",
  };

  const onHeaderClick = () => {
    onSelect?.(card.id);
    setEditing(v => !v);
  };

  return (
    <div
      ref={cardRef}
      style={style}
      data-source-card={card.id}
      data-editing={editing || undefined}
      onWheel={editing ? e => e.stopPropagation() : undefined}
      onPointerDown={editing ? e => e.stopPropagation() : undefined}
      // Double-click body → direct entry to editing mode; single click
      // header also works. We catch the dblclick at card level so it
      // works even while pointer-events are none on the body.
      onDoubleClick={enterEditing}
    >
      <div style={header} onClick={onHeaderClick} title={card.entity.path}>
        <span style={{ color: color.text0, fontWeight: font.weight.medium }}>
          {card.entity.name}
        </span>
        <span
          style={{
            color: color.text2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {dirOf(card.entity.path)}
        </span>
        {card.entity.metrics?.loc !== undefined ? (
          <span style={{ color: color.text3, fontVariantNumeric: "tabular-nums" }}>
            {card.entity.metrics.loc} LoC
          </span>
        ) : null}
        <span
          style={{
            fontSize: font.size.xxs,
            color: editing ? color.text0 : color.text3,
            letterSpacing: font.letter.wide,
            textTransform: "uppercase",
            padding: `1px ${space[1]}px`,
            border: `1px solid ${editing ? color.text2 : color.border}`,
            borderRadius: radius.xs,
            fontFamily: font.sans,
          }}
        >
          {editing ? "edit" : "view"}
        </span>
      </div>
      <div style={BODY_STYLE}>
        {entry.status === "ready" ? (
          <SourceEditor fileId={card.entity.path} source={entry.source} />
        ) : (
          <PlaceholderBody entry={entry} />
        )}
      </div>
    </div>
  );
}

function PlaceholderBody({
  entry,
}: {
  entry: ReturnType<typeof useFileSource>;
}): ReactElement {
  let text = "";
  if (entry.status === "loading") text = "loading…";
  else if (entry.status === "empty") text = "(empty file)";
  else if (entry.status === "error") text = entry.message;
  else text = "";
  return (
    <div style={PLACEHOLDER_STYLE}>
      <span>{text}</span>
    </div>
  );
}

function dirOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(0, slash) : "";
}

const ROOT_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  pointerEvents: "none",
};

const BODY_STYLE: CSSProperties = {
  flex: 1,
  minHeight: 0,
  position: "relative",
  overflow: "hidden",
};

const PLACEHOLDER_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: color.text3,
  fontFamily: font.mono,
  fontSize: font.size.sm,
  fontStyle: "italic",
};
