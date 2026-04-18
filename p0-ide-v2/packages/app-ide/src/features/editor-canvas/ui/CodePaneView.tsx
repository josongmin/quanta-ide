import { useMemo } from "react";
import type { CodePane, LineMarker } from "@quanta/app-ide/entities/canvas";
import { tokenizeLine } from "../lib/highlight";
import { cn } from "@quanta/ui-kit/lib";

interface Viewport { x: number; y: number; scale: number; }

interface Props {
  codePane: CodePane;
  markers: LineMarker[];
  activeLines?: Set<number>;
  viewport?: Viewport;
  containerH?: number;
}

const VIRT_BUFFER = 15; // extra lines rendered above/below viewport

export function CodePaneView({ codePane, markers, activeLines, viewport, containerH }: Props) {
  const lines = codePane.source.split("\n");
  const totalLines = lines.length;
  const LH = codePane.lineHeight;

  // ── Tokenize once per source change ────────────────────────────
  const tokenized = useMemo(
    () => lines.map((l) => tokenizeLine(l)),
    [codePane.source], // lines는 source에서 파생 — source만 deps로 충분
  );

  const markersByLine = useMemo(() => {
    const map = new Map<number, LineMarker[]>();
    for (const m of markers) {
      const list = map.get(m.line);
      if (list) list.push(m);
      else map.set(m.line, [m]);
    }
    return map;
  }, [markers]);

  // ── Virtual line range ──────────────────────────────────────────
  const { firstLine, lastLine } = useMemo(() => {
    if (!viewport || !containerH) return { firstLine: 1, lastLine: totalLines };

    const { y, scale } = viewport;
    // Canvas coordinate range visible on screen
    const canvasTop    = -y / scale;
    const canvasBottom = (-y + containerH) / scale;
    // Relative to top of code lines (offset by codePane.y + 8px padding)
    const relTop    = canvasTop    - codePane.y - 8;
    const relBottom = canvasBottom - codePane.y - 8;

    const first = Math.max(1,          Math.floor(relTop    / LH) - VIRT_BUFFER);
    const last  = Math.min(totalLines, Math.ceil (relBottom / LH) + VIRT_BUFFER);
    return { firstLine: first, lastLine: last };
  }, [viewport, containerH, codePane.y, LH, totalLines]);

  // ── Render a single code line ────────────────────────────────────
  function renderLine(lineNum: number) {
    const lineMarkers = markersByLine.get(lineNum);
    const hasTaintSource = lineMarkers?.some((m) => m.kind === "taint-source");
    const hasTaintSink   = lineMarkers?.some((m) => m.kind === "taint-sink");
    const hasTaintThrough= lineMarkers?.some((m) => m.kind === "taint-through");
    const isActive = activeLines?.has(lineNum);
    const tokens = tokenized[lineNum - 1];

    return (
      <div
        key={lineNum}
        className={cn(
          "code-pane__line",
          hasTaintSource  && "code-pane__line--taint-source",
          hasTaintSink    && "code-pane__line--taint-sink",
          hasTaintThrough && "code-pane__line--taint-through",
          isActive        && "code-pane__line--active",
        )}
        style={{ height: LH }}
      >
        <span className="code-pane__gutter-mark">
          {hasTaintSink   && <span className="code-pane__dot code-pane__dot--sink" />}
          {hasTaintSource && <span className="code-pane__dot code-pane__dot--source" />}
          {hasTaintThrough&& <span className="code-pane__dot code-pane__dot--through" />}
        </span>
        <span className="code-pane__ln">{lineNum}</span>
        <span className="code-pane__text">
          {tokens?.length
            ? tokens.map(([cls, t], ti) => cls ? <span key={ti} className={cls}>{t}</span> : t)
            : " "}
        </span>
      </div>
    );
  }

  const topSpacerH    = (firstLine - 1) * LH;
  const bottomSpacerH = (totalLines - lastLine) * LH;

  return (
    <div
      className="code-pane"
      style={{ left: codePane.x, top: codePane.y, width: codePane.w, paddingTop: 8, paddingBottom: 8 }}
    >
      {topSpacerH > 0    && <div style={{ height: topSpacerH }} />}
      {Array.from({ length: lastLine - firstLine + 1 }, (_, i) => renderLine(firstLine + i))}
      {bottomSpacerH > 0 && <div style={{ height: bottomSpacerH }} />}
    </div>
  );
}
