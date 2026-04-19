import { useCallback, useEffect } from "react";
import {
  annotationsStore,
  useAnnotationsStore,
  ANNOTATION_COLORS,
  type ShapeVariant,
  type ToolKind,
} from "../store/annotations-store";
import { useFeature } from "../store/feature-flags-store";

// Floating vertical annotation toolbar. Each tool button is gated by its
// own feature flag; disabled tools don't render (not ghosted). Parent
// flag `annotation.toolbar` gates the entire toolbar.
//
// Glyphs are 2-3 letter ASCII — NO emoji per project rules.
//   ⇢   pointer / none
//   ~   pen (wavy line)
//   T   text
//   □   shape (with sub-menu for rect/ellipse/arrow)
//   →   connector
//   /   laser
//   ▢   frame

interface ToolDef {
  kind: ToolKind;
  flag: string;
  label: string;
  glyph: string;
}

// "none" is always rendered (reset), gated only by parent toolbar flag.
const NONE_TOOL: ToolDef = { kind: "none", flag: "annotation.toolbar", label: "Select", glyph: "⇢" };

const TOOLS: readonly ToolDef[] = [
  { kind: "pen", flag: "annotation.pen", label: "Pen", glyph: "~" },
  { kind: "text", flag: "annotation.text", label: "Text", glyph: "T" },
  { kind: "shape", flag: "annotation.shape", label: "Shape", glyph: "□" },
  { kind: "connector", flag: "annotation.connector", label: "Connector", glyph: "→" },
  { kind: "laser", flag: "annotation.laser", label: "Laser", glyph: "/" },
  { kind: "frame", flag: "annotation.frame", label: "Frame", glyph: "▢" },
] as const;

const SHAPE_VARIANTS: readonly { variant: ShapeVariant; glyph: string; label: string }[] = [
  { variant: "rect", glyph: "□", label: "Rectangle" },
  { variant: "ellipse", glyph: "○", label: "Ellipse" },
  { variant: "arrow", glyph: "→", label: "Arrow" },
];

export function AnnotationToolbar() {
  const toolbarOn = useFeature("annotation.toolbar");
  const activeTool = useAnnotationsStore(s => s.activeTool);
  const shapeVariant = useAnnotationsStore(s => s.shapeVariant);
  const penColor = useAnnotationsStore(s => s.penColor);
  const shapeColor = useAnnotationsStore(s => s.shapeColor);

  // Individually-flagged tools — recomputed on each render; cheap.
  const penOn = useFeature("annotation.pen");
  const textOn = useFeature("annotation.text");
  const shapeOn = useFeature("annotation.shape");
  const connectorOn = useFeature("annotation.connector");
  const laserOn = useFeature("annotation.laser");
  const frameOn = useFeature("annotation.frame");

  const flagMap: Record<string, boolean> = {
    "annotation.pen": penOn,
    "annotation.text": textOn,
    "annotation.shape": shapeOn,
    "annotation.connector": connectorOn,
    "annotation.laser": laserOn,
    "annotation.frame": frameOn,
  };

  const onPick = useCallback((kind: ToolKind) => {
    annotationsStore.setTool(kind);
  }, []);

  // ESC → reset to "none" even when focus isn't on the canvas.
  useEffect(() => {
    if (!toolbarOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (annotationsStore.getState().activeTool !== "none") {
        annotationsStore.setTool("none");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toolbarOn]);

  if (!toolbarOn) return null;

  const showColorPucks = activeTool === "pen" || activeTool === "shape";
  const currentColor = activeTool === "pen" ? penColor : shapeColor;
  const onColorPick = (c: string) => {
    if (activeTool === "pen") annotationsStore.setPenColor(c);
    else if (activeTool === "shape") annotationsStore.setShapeColor(c);
  };

  return (
    <div className="ws-anno-toolbar" role="toolbar" aria-label="Annotation tools">
      <button
        type="button"
        className={`ws-anno-toolbar__btn${activeTool === "none" ? " is-on" : ""}`}
        onClick={() => onPick(NONE_TOOL.kind)}
        title={`${NONE_TOOL.label} (Esc)`}
        aria-label={`${NONE_TOOL.label} (Esc)`}
        aria-pressed={activeTool === "none"}
      >
        <span aria-hidden="true">{NONE_TOOL.glyph}</span>
      </button>
      {TOOLS.filter(t => flagMap[t.flag]).map(t => (
        <button
          key={t.kind}
          type="button"
          className={`ws-anno-toolbar__btn${activeTool === t.kind ? " is-on" : ""}`}
          onClick={() => onPick(t.kind)}
          title={t.label}
          aria-label={t.label}
          aria-pressed={activeTool === t.kind}
          data-tool={t.kind}
        >
          <span aria-hidden="true">{t.glyph}</span>
        </button>
      ))}

      {activeTool === "shape" && shapeOn && (
        <div className="ws-anno-toolbar__sub" role="group" aria-label="Shape variant">
          {SHAPE_VARIANTS.map(v => (
            <button
              key={v.variant}
              type="button"
              className={`ws-anno-toolbar__sub-btn${shapeVariant === v.variant ? " is-on" : ""}`}
              onClick={() => annotationsStore.setShapeVariant(v.variant)}
              title={v.label}
              aria-pressed={shapeVariant === v.variant}
            >
              {v.glyph}
            </button>
          ))}
        </div>
      )}

      {showColorPucks && (
        <div className="ws-anno-toolbar__colors" role="group" aria-label="Color">
          {ANNOTATION_COLORS.map(c => (
            <button
              key={c}
              type="button"
              className={`ws-anno-toolbar__puck${c === currentColor ? " is-on" : ""}`}
              style={{ background: c }}
              onClick={() => onColorPick(c)}
              aria-label={`color ${c}`}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  );
}
