import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import type { EntityTree } from "@quanta/canvas-engine";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { useFileSource } from "../model/store";
import { closeEditor, useEditorTarget } from "../model/editor-target";
import { SourceEditor } from "./SourceEditor";

// SourceOverlay — single-file edit overlay over the Pixi scene.
// --------------------------------------------------------------------
// The canvas is a structural map now, not a sea of code cards. File
// content isn't shown ambient at every visible card (that was the old
// design with up to 16 live CodeMirror instances). Instead this
// overlay renders ONE centered editor when a user explicitly opens a
// file — typically via dblclick on a building-tier card or the
// Inspector's Edit button. Closing returns to pure structural view.
//
// Why a centered modal instead of sizing-to-rect: at building tier
// cards can be anywhere from a sliver to half-viewport, so a
// rect-positioned editor needed a clamp/expand step that pulled it
// away from its underlying card. Centering it removes that
// discontinuity — the user clicks "open file", a proper editor
// appears; it's not claiming to occupy the card's footprint.

export interface SourceOverlayProps {
  tree: EntityTree;
  viewportWidth: number;
  viewportHeight: number;
}

const OVERLAY_MIN_W = 720;
const OVERLAY_MIN_H = 520;
const OVERLAY_MAX_W = 1200;
const OVERLAY_MAX_H = 820;
const OVERLAY_VIEWPORT_MARGIN = 48;

export function SourceOverlay(props: SourceOverlayProps): ReactElement | null {
  const activeId = useEditorTarget();
  if (!activeId) return null;
  const entity = props.tree.byId.get(activeId);
  if (!entity || entity.kind !== "building") return null;

  return (
    <EditorOverlay
      key={entity.id}
      path={entity.path}
      name={entity.name}
      loc={entity.metrics?.loc}
      viewportWidth={props.viewportWidth}
      viewportHeight={props.viewportHeight}
    />
  );
}

interface EditorOverlayProps {
  path: string;
  name: string;
  loc: number | undefined;
  viewportWidth: number;
  viewportHeight: number;
}

function EditorOverlay({
  path,
  name,
  loc,
  viewportWidth,
  viewportHeight,
}: EditorOverlayProps): ReactElement {
  const entry = useFileSource(path);
  const [draft, setDraft] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Esc + click-outside dismisses. `mousedown` capture so we don't
  // race the canvas's own pointerdown handler, which would otherwise
  // treat the dismissal click as a deselect / pan start.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEditor();
    };
    const onMouseDown = (e: MouseEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) closeEditor();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown, true);
    };
  }, []);

  const width = Math.min(
    OVERLAY_MAX_W,
    Math.max(OVERLAY_MIN_W, viewportWidth - OVERLAY_VIEWPORT_MARGIN * 2),
  );
  const height = Math.min(
    OVERLAY_MAX_H,
    Math.max(OVERLAY_MIN_H, viewportHeight - OVERLAY_VIEWPORT_MARGIN * 2),
  );
  const left = Math.max(0, (viewportWidth - width) / 2);
  const top = Math.max(0, (viewportHeight - height) / 2);

  const onSave = useCallback(() => {
    // Persistence intentionally stubbed — the edit seam is the UX
    // contract here; wiring it to a write endpoint is a follow-up.
    closeEditor();
  }, []);

  const ready = entry.status === "ready";
  const sourceText = ready ? entry.source : "";
  const editorValue = draft ?? sourceText;

  return (
    <div style={SCRIM_STYLE} aria-modal="true" role="dialog">
      <div
        ref={rootRef}
        style={{ ...PANEL_STYLE, left, top, width, height }}
        data-source-overlay
        onWheel={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div style={HEADER_STYLE}>
          <span style={{ color: color.text0, fontWeight: font.weight.medium }}>
            {name}
          </span>
          <span style={PATH_STYLE}>{dirOf(path)}</span>
          {loc !== undefined ? (
            <span style={{ color: color.text3, fontVariantNumeric: "tabular-nums" }}>
              {loc} LoC
            </span>
          ) : null}
          <button type="button" onClick={onSave} style={DONE_BTN_STYLE} title="Close (Esc)">
            Done
          </button>
        </div>
        <div style={BODY_STYLE}>
          {ready ? (
            <SourceEditor
              fileId={path}
              source={editorValue}
              editable
              onChange={setDraft}
            />
          ) : (
            <PlaceholderBody entry={entry} />
          )}
        </div>
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

const SCRIM_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(10, 10, 10, 0.28)",
  pointerEvents: "auto",
  zIndex: 50,
};

const PANEL_STYLE: CSSProperties = {
  position: "absolute",
  background: color.bg1,
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow:
    "0 20px 60px rgba(10, 10, 10, 0.28), 0 6px 20px rgba(10, 10, 10, 0.14)",
  pointerEvents: "auto",
  transition: `box-shadow ${transition.fast}`,
};

const HEADER_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
  background: color.bg2,
  fontFamily: font.mono,
  fontSize: font.size.sm,
  color: color.text1,
  flexShrink: 0,
  userSelect: "none",
};

const PATH_STYLE: CSSProperties = {
  color: color.text2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
};

const DONE_BTN_STYLE: CSSProperties = {
  padding: `2px ${space[3]}px`,
  background: color.accent,
  color: "#ffffff",
  border: "none",
  borderRadius: radius.xs,
  fontFamily: font.sans,
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
  cursor: "pointer",
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
