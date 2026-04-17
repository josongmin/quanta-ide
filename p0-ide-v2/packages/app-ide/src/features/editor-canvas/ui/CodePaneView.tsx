import { useMemo } from "react";
import type { CodePane, LineMarker } from "@quanta/app-ide/entities/canvas";
import { tokenizeLine } from "../lib/highlight";
import { cn } from "@quanta/ui-kit/lib";

interface Props {
  codePane: CodePane;
  markers: LineMarker[];
  activeLines?: Set<number>;
}

export function CodePaneView({ codePane, markers, activeLines }: Props) {
  const lines = codePane.source.split("\n");

  const markersByLine = useMemo(() => {
    const map = new Map<number, LineMarker[]>();
    for (const m of markers) {
      const list = map.get(m.line);
      if (list) list.push(m);
      else map.set(m.line, [m]);
    }
    return map;
  }, [markers]);

  // ── Render a code line ──────────────────────────────────────────
  function renderLine(lineNum: number) {
    const text = lines[lineNum - 1] ?? "";
    const lineMarkers = markersByLine.get(lineNum);
    const hasTaintSource = lineMarkers?.some((m) => m.kind === "taint-source");
    const hasTaintSink = lineMarkers?.some((m) => m.kind === "taint-sink");
    const hasTaintThrough = lineMarkers?.some((m) => m.kind === "taint-through");
    const isActive = activeLines?.has(lineNum);

    return (
      <div
        key={lineNum}
        className={cn(
          "code-pane__line",
          hasTaintSource && "code-pane__line--taint-source",
          hasTaintSink && "code-pane__line--taint-sink",
          hasTaintThrough && "code-pane__line--taint-through",
          isActive && "code-pane__line--active",
        )}
        style={{ height: codePane.lineHeight }}
      >
        <span className="code-pane__gutter-mark">
          {hasTaintSink && <span className="code-pane__dot code-pane__dot--sink" />}
          {hasTaintSource && <span className="code-pane__dot code-pane__dot--source" />}
          {hasTaintThrough && <span className="code-pane__dot code-pane__dot--through" />}
        </span>
        <span className="code-pane__ln">{lineNum}</span>
        <span className="code-pane__text">
          {text ? tokenizeLine(text).map(([cls, t], ti) =>
            cls ? <span key={ti} className={cls}>{t}</span> : t,
          ) : " "}
        </span>
      </div>
    );
  }

  // ── Main render: all lines expanded ────────────────────────────
  return (
    <div
      className="code-pane"
      style={{ left: codePane.x, top: codePane.y, width: codePane.w, paddingTop: 8, paddingBottom: 8 }}
    >
      {lines.map((_, i) => renderLine(i + 1))}
    </div>
  );
}
