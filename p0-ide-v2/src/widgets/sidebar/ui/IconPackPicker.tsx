import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ICON_PACK_ORDER, ICON_PACKS } from "@/shared/ui/icons";
import {
  ICON_COLOR_OPTIONS,
  iconColorStore,
  iconPackStore,
  resolveIconColor,
  useIconColor,
  useIconPack,
} from "@/shared/model/icon-pack-store";

interface Props {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

const PREVIEW_FILES = ["orchestrator.py", "Sidebar.tsx", "styles.css", "config.toml"];
const POPUP_WIDTH = 252;
const MARGIN = 8;

interface Placement {
  top: number;
  left: number;
  origin: "top" | "bottom";
}

function computePlacement(anchor: DOMRect, popupHeight: number): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchor.right - POPUP_WIDTH;
  left = Math.max(MARGIN, Math.min(left, vw - POPUP_WIDTH - MARGIN));

  const spaceBelow = vh - anchor.bottom - MARGIN;
  const spaceAbove = anchor.top - MARGIN;
  const placeBelow = spaceBelow >= popupHeight || spaceBelow >= spaceAbove;

  const top = placeBelow
    ? Math.min(anchor.bottom + 6, vh - popupHeight - MARGIN)
    : Math.max(MARGIN, anchor.top - popupHeight - 6);

  return { top, left, origin: placeBelow ? "top" : "bottom" };
}

export function IconPackPicker({ anchorRef, onClose }: Props) {
  const current = useIconPack();
  const currentColor = useIconColor();
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const popupHeight = ref.current?.offsetHeight ?? 420;
    setPlacement(computePlacement(anchor.getBoundingClientRect(), popupHeight));
  }, [anchorRef]);

  useEffect(() => {
    function reposition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const popupHeight = ref.current?.offsetHeight ?? 420;
      setPlacement(computePlacement(anchor.getBoundingClientRect(), popupHeight));
    }
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [anchorRef, onClose]);

  const resolvedColor = resolveIconColor(currentColor);
  const colorVar = resolvedColor ? ({ "--files-icon-color": resolvedColor } as React.CSSProperties) : {};
  const style: React.CSSProperties = placement
    ? {
        top: placement.top,
        left: placement.left,
        width: POPUP_WIDTH,
        transformOrigin: placement.origin === "top" ? "top right" : "bottom right",
        ...colorVar,
      }
    : { visibility: "hidden", top: 0, left: 0, width: POPUP_WIDTH, ...colorVar };

  return createPortal(
    <div
      ref={ref}
      className="ide-files-iconpack"
      role="dialog"
      aria-label="Select icon pack"
      style={style}
    >
      <div className="ide-files-iconpack__head">
        <span className="ide-files-iconpack__title">Icon pack</span>
        <span className="ide-files-iconpack__sub">Applies to file tree</span>
      </div>
      <div className="ide-files-iconpack__colors" role="group" aria-label="Icon color">
        <span className="ide-files-iconpack__colors-label">Color</span>
        <div className="ide-files-iconpack__swatches">
          {ICON_COLOR_OPTIONS.map((opt) => {
            const active = opt.id === currentColor;
            const isDefault = opt.value === null;
            return (
              <button
                key={opt.id}
                type="button"
                className={`ide-files-iconpack__swatch${active ? " is-active" : ""}${isDefault ? " is-default" : ""}`}
                style={opt.value ? { background: opt.value } : undefined}
                onClick={() => iconColorStore.set(opt.id)}
                aria-label={opt.label}
                aria-pressed={active}
                title={opt.label}
              />
            );
          })}
        </div>
      </div>
      <div className="ide-files-iconpack__list">
        {ICON_PACK_ORDER.map((id) => {
          const pack = ICON_PACKS[id];
          const active = id === current;
          return (
            <button
              type="button"
              key={id}
              className={`ide-files-iconpack__item${active ? " is-active" : ""}`}
              onClick={() => {
                iconPackStore.set(id);
              }}
            >
              <div className="ide-files-iconpack__meta">
                <span className="ide-files-iconpack__name">{pack.label}</span>
                <span className="ide-files-iconpack__hint">{pack.hint}</span>
              </div>
              <div className="ide-files-iconpack__preview" aria-hidden="true">
                <pack.Folder open={true} />
                {PREVIEW_FILES.map((f) => (
                  <span key={f} className="ide-files-iconpack__preview-slot">
                    {pack.pickFile(f)}
                  </span>
                ))}
              </div>
              {active && <span className="ide-files-iconpack__check">✓</span>}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
