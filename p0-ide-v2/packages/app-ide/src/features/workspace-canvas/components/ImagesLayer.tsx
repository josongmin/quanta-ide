import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  imagesStore,
  useImagesStore,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_COUNT,
  type CanvasImage,
} from "../store/images-store";
import { viewportStore } from "../store/viewport-store";
import { useFeature } from "../store/feature-flags-store";
import { showToast as showSharedToast } from "../lib/toast";

interface Props {
  transform: string;
  scale: number;
  containerRef: RefObject<HTMLDivElement | null>;
}

type DragMode = "move" | "resize";

interface DragRef {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  mode: DragMode;
}

const DEFAULT_MAX_WIDTH = 520;
const DEFAULT_MAX_HEIGHT = 360;

// ── Image paste layer ────────────────────────────────────────────────
// A world-transformed DOM layer (mirrors StickiesLayer) that renders
// every pasted CanvasImage as a draggable / resizable card. The paste
// handler itself is attached to `containerRef.current` so pastes are
// scoped to the canvas surface rather than stealing pastes from text
// inputs elsewhere in the app.
export function ImagesLayer({ transform, scale, containerRef }: Props) {
  const enabled = useFeature("embeds.imagePaste");
  const images = useImagesStore(s => s.images);
  const activeId = useImagesStore(s => s.activeId);

  const layerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const dragRef = useRef<DragRef | null>(null);

  // Mirror the viewport transform imperatively (same pattern as StickiesLayer).
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    el.style.transform = transform;
  }, [transform]);

  // Track cursor position over the canvas so paste can land images at
  // the current mouse spot. Fallback = viewport center.
  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      cursorRef.current = { clientX: e.clientX, clientY: e.clientY };
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, [enabled, containerRef]);

  // Paste listener — attached to the window so it fires regardless of
  // canvas focus, but we bail out if the paste target is an editable
  // element (text input / textarea / contenteditable) so typing pastes
  // elsewhere still work normally.
  useEffect(() => {
    if (!enabled) return;

    const showToast = (text: string) => {
      showSharedToast(text, 2500);
    };

    const isEditableTarget = (t: EventTarget | null): boolean => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const onPaste = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it || it.kind !== "file") continue;
        if (!it.type.startsWith("image/")) continue;
        const file = it.getAsFile();
        if (!file) continue;
        e.preventDefault();
        void decodeAndStore(file, containerRef.current, cursorRef.current, showToast);
        return;
      }
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enabled, containerRef]);

  // Toast dismissal now lives inside the shared toast store ttl.

  // Drag handlers — both for image move (header) and resize (corner).
  const onPointerDownMove = useCallback(
    (id: string, e: ReactPointerEvent<HTMLElement>) => {
      const img = imagesStore.getState().images.find(i => i.id === id);
      if (!img || img.locked) return;
      if (e.button !== 0) return;
      dragRef.current = {
        id,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: img.x,
        startY: img.y,
        startW: img.w,
        startH: img.h,
        mode: "move",
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      imagesStore.setActive(id);
    },
    [],
  );

  const onPointerDownResize = useCallback(
    (id: string, e: ReactPointerEvent<HTMLElement>) => {
      const img = imagesStore.getState().images.find(i => i.id === id);
      if (!img || img.locked) return;
      if (e.button !== 0) return;
      dragRef.current = {
        id,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: img.x,
        startY: img.y,
        startW: img.w,
        startH: img.h,
        mode: "resize",
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      imagesStore.setActive(id);
    },
    [],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const vp = viewportStore.getState().viewport;
      if (vp.scale <= 0) return;
      const dxScreen = e.clientX - drag.startClientX;
      const dyScreen = e.clientY - drag.startClientY;
      const dxWorld = dxScreen / vp.scale;
      const dyWorld = dyScreen / vp.scale;
      if (drag.mode === "move") {
        imagesStore.setPosition(drag.id, drag.startX + dxWorld, drag.startY + dyWorld);
      } else {
        imagesStore.setSize(drag.id, drag.startW + dxWorld, drag.startH + dyWorld);
      }
    };
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // Outside click deactivates (same pattern as stickies).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const a = imagesStore.getState().activeId;
      if (!a) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(`[data-canvas-image-id="${a}"]`)) return;
      imagesStore.setActive(null);
    };
    window.addEventListener("mousedown", onDown, true);
    return () => window.removeEventListener("mousedown", onDown, true);
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={layerRef}
        className="workspace-canvas__images-layer"
        style={{ transformOrigin: "0 0" }}
      >
        {images.map(img => (
          <ImageCard
            key={img.id}
            image={img}
            isActive={activeId === img.id}
            scale={scale}
            onMoveStart={onPointerDownMove}
            onResizeStart={onPointerDownResize}
          />
        ))}
      </div>
    </>
  );
}

interface ImageCardProps {
  image: CanvasImage;
  isActive: boolean;
  scale: number;
  onMoveStart: (id: string, e: ReactPointerEvent<HTMLElement>) => void;
  onResizeStart: (id: string, e: ReactPointerEvent<HTMLElement>) => void;
}

const ImageCardInner = ({
  image,
  isActive,
  scale,
  onMoveStart,
  onResizeStart,
}: ImageCardProps) => {
  const [editingCaption, setEditingCaption] = useState(false);
  const [draftCaption, setDraftCaption] = useState(image.caption ?? "");

  const onDoubleClickBody = useCallback(() => {
    if (image.locked) return;
    setDraftCaption(image.caption ?? "");
    setEditingCaption(true);
  }, [image.caption, image.locked]);

  const commitCaption = useCallback(() => {
    imagesStore.setCaption(image.id, draftCaption.trim());
    setEditingCaption(false);
  }, [image.id, draftCaption]);

  const onDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    imagesStore.remove(image.id);
  }, [image.id]);

  const onLock = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    imagesStore.toggleLocked(image.id);
  }, [image.id]);

  const invScale = scale > 0 ? 1 / scale : 1;

  const style = useMemo<CSSProperties>(() => ({
    left: image.x,
    top: image.y,
    width: image.w,
    height: image.h,
    ["--img-inv-scale" as string]: invScale.toFixed(4),
  }), [image.x, image.y, image.w, image.h, invScale]);

  const classNames = [
    "ws-image",
    isActive ? "ws-image--active" : "",
    image.locked ? "ws-image--locked" : "",
    image.anchorFileId ? "ws-image--anchored" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classNames}
      style={style}
      data-canvas-image-id={image.id}
      onPointerDown={e => {
        if (isActive) return;
        imagesStore.setActive(image.id);
        e.stopPropagation();
      }}
      onContextMenu={e => {
        e.preventDefault();
        imagesStore.toggleLocked(image.id);
      }}
    >
      <div
        className="ws-image__header"
        onPointerDown={e => onMoveStart(image.id, e)}
      >
        <span className="ws-image__label">image</span>
        <div className="ws-image__actions">
          <button
            type="button"
            className="ws-image__btn"
            onClick={onLock}
            title={image.locked ? "unlock" : "lock"}
            aria-label={image.locked ? "unlock image" : "lock image"}
          >
            {image.locked ? "L" : "U"}
          </button>
          <button
            type="button"
            className="ws-image__btn ws-image__btn--danger"
            onClick={onDelete}
            title="delete"
            aria-label="delete image"
          >
            ×
          </button>
        </div>
      </div>
      <div className="ws-image__body" onDoubleClick={onDoubleClickBody}>
        <img
          className="ws-image__img"
          src={image.dataUrl}
          alt={image.caption ?? "pasted image"}
          draggable={false}
        />
      </div>
      {(editingCaption || image.caption) && (
        <div className="ws-image__caption">
          {editingCaption ? (
            <input
              type="text"
              className="ws-image__caption-input"
              value={draftCaption}
              placeholder="caption…"
              autoFocus
              onChange={e => setDraftCaption(e.target.value)}
              onBlur={commitCaption}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitCaption();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditingCaption(false);
                }
              }}
            />
          ) : (
            <span className="ws-image__caption-text">{image.caption}</span>
          )}
        </div>
      )}
      {!image.locked && (
        <div
          className="ws-image__resize"
          onPointerDown={e => onResizeStart(image.id, e)}
          aria-label="resize image"
        />
      )}
    </div>
  );
};

const ImageCard = memo(ImageCardInner);

// ── Helpers ──────────────────────────────────────────────────────────

function decodeAndStore(
  file: File,
  container: HTMLDivElement | null,
  cursor: { clientX: number; clientY: number } | null,
  showToast: (text: string) => void,
): Promise<void> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) {
        showToast("image decode failed");
        resolve();
        return;
      }
      computeWorldPosition(container, cursor).then(pos => {
        const img = new Image();
        img.onload = () => {
          const { w, h } = bound(img.naturalWidth, img.naturalHeight);
          const res = imagesStore.tryAdd({ x: pos.x - w / 2, y: pos.y - h / 2, w, h, dataUrl });
          if (!res.ok) {
            if (res.reason === "too-large") {
              const mb = ((res.sizeBytes ?? 0) / (1024 * 1024)).toFixed(2);
              showToast(`image too large (${mb} MB > ${(IMAGE_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB)`);
            } else {
              showToast(`image cap reached (max ${IMAGE_MAX_COUNT})`);
            }
          }
          resolve();
        };
        img.onerror = () => {
          showToast("image decode failed");
          resolve();
        };
        img.src = dataUrl;
      });
    };
    reader.onerror = () => {
      showToast("image decode failed");
      resolve();
    };
    reader.readAsDataURL(file);
  });
}

async function computeWorldPosition(
  container: HTMLDivElement | null,
  cursor: { clientX: number; clientY: number } | null,
): Promise<{ x: number; y: number }> {
  const vp = viewportStore.getState().viewport;
  if (vp.scale <= 0) return { x: 0, y: 0 };
  if (container && cursor) {
    const rect = container.getBoundingClientRect();
    const inX = cursor.clientX - rect.left;
    const inY = cursor.clientY - rect.top;
    if (inX >= 0 && inX <= rect.width && inY >= 0 && inY <= rect.height) {
      return {
        x: (inX - vp.x) / vp.scale,
        y: (inY - vp.y) / vp.scale,
      };
    }
  }
  // Fallback — viewport center in world coords.
  return {
    x: (vp.width / 2 - vp.x) / vp.scale,
    y: (vp.height / 2 - vp.y) / vp.scale,
  };
}

function bound(nw: number, nh: number): { w: number; h: number } {
  if (nw <= 0 || nh <= 0) return { w: 280, h: 200 };
  const aspect = nw / nh;
  let w = nw;
  let h = nh;
  if (w > DEFAULT_MAX_WIDTH) { w = DEFAULT_MAX_WIDTH; h = w / aspect; }
  if (h > DEFAULT_MAX_HEIGHT) { h = DEFAULT_MAX_HEIGHT; w = h * aspect; }
  return { w: Math.max(80, Math.round(w)), h: Math.max(60, Math.round(h)) };
}
