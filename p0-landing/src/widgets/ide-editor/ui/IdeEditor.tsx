import type { ReactNode, MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useEditorHover, type LineContext, type SymbolInfo } from "@/features/ide-editor-hover";
import { useFlowTrace } from "@/features/ide-flow-trace";
import { useInspectorContext } from "@/features/ide-inspector-context";

export interface CodeLine {
  no: number;
  risk?: 1 | 2 | 3 | 4;
  fold?: string;
  code: ReactNode;
  inline?: string;
  inlineKind?: "normal" | "warn";
  context?: LineContext;
}

interface IdeEditorProps {
  tabs: { name: string; active?: boolean }[];
  lines: CodeLine[];
  liveTypingLine?: ReactNode;
  flowTraceBanner?: ReactNode;
  impactBanner?: ReactNode;
  onTabClick?: (name: string) => void;
  onTabClose?: (name: string) => void;
}

export function IdeEditor({ tabs, lines, liveTypingLine, flowTraceBanner, impactBanner, onTabClick, onTabClose }: IdeEditorProps) {
  const { t } = useTranslation();
  const setLine = useEditorHover((s) => s.setLine);
  const setSymbol = useEditorHover((s) => s.setSymbol);
  const hoveredLineNo = useEditorHover((s) => s.hoveredLine?.lineNo);
  const traceLines = useFlowTrace((s) => s.lines);
  const isTraceActive = useFlowTrace((s) => s.isActive);

  const tracedSet = new Set(traceLines.map((t) => t.lineNo));
  const traceKindMap = new Map(traceLines.map((t) => [t.lineNo, t.kind]));

  const onLineEnter = (line: CodeLine) => () => {
    setLine(line.context ?? { lineNo: line.no, risk: line.risk });
  };
  const onLineLeave = () => {
    setLine(null);
  };

  const _onSymbolEnter = (info: SymbolInfo) => (e: ReactMouseEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSymbol({ info, x: rect.left, y: rect.bottom });
  };
  const _onSymbolLeave = () => {
    setSymbol(null);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- mouse-only context preview
    <main className="ide-editor" onMouseLeave={onLineLeave}>
      <div className="ide-editor-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            type="button"
            className={`ide-editor-tab${tab.active ? " is-active" : ""}`}
            onClick={() => onTabClick?.(tab.name)}
          >
            <span>{tab.name}</span>
            {onTabClose && (
              <span
                className="ide-editor-tab-close"
                role="button"
                tabIndex={0}
                aria-label={t("ide.editor.closeTabNamed", { name: tab.name })}
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.name); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onTabClose(tab.name);
                  }
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
      </div>
      {flowTraceBanner}
      <div className="ide-editor-body">
        {lines.map((line) => {
          const isHovered = hoveredLineNo === line.no;
          const isTraced = isTraceActive && tracedSet.has(line.no);
          const traceKind = traceKindMap.get(line.no);
          const traceClass = isTraced
            ? ` is-traced${traceKind === "source" ? " is-trace-source" : ""}${traceKind === "sink" ? " is-trace-sink" : ""}`
            : "";
          return (
            <div key={line.no}>
              {/* Insert live typing line after line 7 */}
              {line.no === 8 && liveTypingLine}
              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- mouse-only context preview */}
              <div
                className={`ide-editor-line${isHovered ? " is-hovered" : ""}${traceClass}`}
                onMouseEnter={onLineEnter(line)}
              >
                <span className="ide-editor-lineno">{line.no}</span>
                <span className="ide-editor-gutter" data-risk={line.risk ?? ""} />
                <span className="ide-editor-fold">{line.fold ?? ""}</span>
                <SymbolizedCode
                  content={line.code}
                  onSymbolEnter={_onSymbolEnter}
                  onSymbolLeave={_onSymbolLeave}
                />
                {line.inline && (
                  <span className="ide-editor-inline">
                    <span className={line.inlineKind === "warn" ? "warn" : "delta"}>
                      {line.inline}
                    </span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {impactBanner}
    </main>
  );
}

/**
 * Wraps the line content. Children may include `<HoverSymbol>` markers
 * created by the page (which already wires hover handlers via context).
 * For the basic case we just render `code` as-is — interaction is opt-in
 * via the `HoverSymbol` helper component below.
 */
function SymbolizedCode({
  content,
  // intentionally accept handlers so they're stable in the tree even though
  // each `HoverSymbol` reads from the store directly
  onSymbolEnter: _onEnter,
  onSymbolLeave: _onLeave,
}: {
  content: ReactNode;
  onSymbolEnter: (info: SymbolInfo) => (e: ReactMouseEvent<HTMLSpanElement>) => void;
  onSymbolLeave: () => void;
}) {
  return <span className="ide-editor-code">{content}</span>;
}

/**
 * Inline interactive symbol. Use inside line.code to make tokens hoverable.
 *   <HoverSymbol info={{ name: "amount", kind: "variable", taint: "source" }}>
 *     amount
 *   </HoverSymbol>
 */
export function HoverSymbol({ info, children }: { info: SymbolInfo; children: ReactNode }) {
  const setSymbol = useEditorHover((s) => s.setSymbol);
  const { context, setSymbolContext } = useInspectorContext();
  const currentFileName = context.mode === "file" ? context.fileName : context.fileName;
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- mouse-only symbol info
    <span
      className="ide-editor-sym"
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setSymbol({ info, x: rect.left, y: rect.bottom });
      }}
      onMouseLeave={() => { setSymbol(null); }}
      onClick={(e) => {
        e.stopPropagation();
        if (info.kind === "function") {
          setSymbolContext({
            name: info.name,
            kind: info.kind,
            taint: info.taint,
            callers: info.callers,
            complexity: info.complexity,
            blame: info.blame,
            origin: info.origin,
            flowsTo: info.flowsTo,
            fileName: currentFileName,
          });
        }
      }}
    >
      {children}
    </span>
  );
}
