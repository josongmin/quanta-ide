import type { ReactNode, MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useEditorHover, type LineContext, type SymbolInfo } from "@/features/ide-editor-hover";
import { useFlowTrace } from "@/features/ide-flow-trace";
import { useInspectorContext } from "@/features/ide-inspector-context";
import { FileTypeIcon } from "@/shared/ui";

export type LineHint =
  | { type: "author"; name: string; when: string }
  | { type: "coverage"; passed: number; total: number }
  | { type: "taint-flow"; from: string; to: string }
  | { type: "callers"; count: number; warn?: boolean }
  | { type: "blast"; files: number }
  | { type: "stale"; age: string }
  | { type: "warn-badge"; label: string }
  | { type: "complexity"; value: number };

/* ── Hint renderers (type → render fn) ─────────────────────────────── */

// Each renderer returns JSX for a single hint chip. Keyed externally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- union-discriminated dispatch
const HINT_RENDERERS: Record<string, (h: any) => ReactNode> = {
  author: (h: Extract<LineHint, { type: "author" }>) => (
    <span className="ilh ilh-author">
      <span className="ilh-at">@</span>{h.name.replace("@", "")}
      <span className="ilh-sep">·</span>{h.when}
    </span>
  ),
  coverage: (h: Extract<LineHint, { type: "coverage" }>) => {
    const pct = h.total ? Math.round((h.passed / h.total) * 100) : 0;
    const bad = pct === 0;
    return (
      <span className={`ilh ilh-cov${bad ? " is-bad" : ""}`}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        {h.passed}/{h.total}
      </span>
    );
  },
  "taint-flow": (h: Extract<LineHint, { type: "taint-flow" }>) => (
    <span className="ilh ilh-taint-flow">
      <span className="ilh-src">{h.from}</span>
      <svg width="10" height="8" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="0" y1="8" x2="18" y2="8"/><polyline points="12 2 20 8 12 14"/></svg>
      <span className="ilh-sink">{h.to}</span>
    </span>
  ),
  callers: (h: Extract<LineHint, { type: "callers" }>) => (
    <span className={`ilh ilh-callers${h.warn ? " is-warn" : ""}`}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      {h.count}
    </span>
  ),
  blast: (h: Extract<LineHint, { type: "blast" }>) => (
    <span className="ilh ilh-blast">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      {h.files} files
    </span>
  ),
  stale: (h: Extract<LineHint, { type: "stale" }>) => (
    <span className="ilh ilh-stale">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      {h.age}
    </span>
  ),
  "warn-badge": (h: Extract<LineHint, { type: "warn-badge" }>) => (
    <span className="ilh ilh-warn-badge">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      {h.label}
    </span>
  ),
  complexity: (h: Extract<LineHint, { type: "complexity" }>) => (
    <span className={`ilh ilh-cpx${h.value >= 7 ? " is-high" : h.value >= 4 ? " is-mid" : ""}`}>
      cpx {h.value.toFixed(1)}
    </span>
  ),
};

export interface CodeLine {
  no: number;
  risk?: 1 | 2 | 3 | 4;
  fold?: string;
  code: ReactNode;
  inline?: string;
  inlineKind?: "normal" | "warn";
  hints?: LineHint[];
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

  const onLineEnter = (line: CodeLine) => (e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setLine({ ...(line.context ?? { lineNo: line.no, risk: line.risk }), x: rect.left + 40, y: rect.top });
  };
  const onLineLeave = () => {
    setLine(null);
  };

  const scheduleDismiss_ = useEditorHover((s) => s.scheduleDismiss);
  const _onSymbolEnter = (info: SymbolInfo) => (e: ReactMouseEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSymbol({ info, anchor: { left: rect.left, top: rect.top, bottom: rect.bottom } });
  };
  const _onSymbolLeave = () => {
    scheduleDismiss_();
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
            <FileTypeIcon filename={tab.name} size={15} />
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
                data-editor-line={line.no}
                className={`ide-editor-line${isHovered ? " is-hovered" : ""}${traceClass}`}
                onMouseEnter={onLineEnter(line)}
              >
                <span className="ide-editor-lineno">{line.no}</span>
                <span className="ide-editor-gutter" data-risk={line.risk ?? ""} />
                <span className="ide-editor-fold">{line.fold ?? ""}</span>
                <span className="ide-editor-line-code">
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
                  {line.hints && line.hints.length > 0 && (
                    <span className="ide-line-hints">
                    {line.hints.map((h, i) => (
                      <span key={i}>{HINT_RENDERERS[h.type](h)}</span>
                    ))}
                    </span>
                  )}
                </span>
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
  const scheduleDismiss = useEditorHover((s) => s.scheduleDismiss);
  const { context, setSymbolContext } = useInspectorContext();
  const currentFileName = context.mode !== "repo" && context.mode !== "impact" ? context.fileName : "";
  return (
    <span
      className="ide-editor-sym"
      role="button"
      tabIndex={-1}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setSymbol({ info, anchor: { left: rect.left, top: rect.top, bottom: rect.bottom } });
      }}
      onMouseLeave={() => { scheduleDismiss(); }}
      onClick={(e) => {
        e.stopPropagation();
        setSymbolContext({
          name: info.name,
          kind: info.kind,
          taint: "taint" in info ? info.taint : undefined,
          callers: "callers" in info ? info.callers : undefined,
          complexity: "complexity" in info ? info.complexity : undefined,
          blame: info.blame,
          origin: "origin" in info ? info.origin : undefined,
          flowsTo: "flowsTo" in info ? info.flowsTo : undefined,
          riskScore: info.riskScore,
          detail: info.detail,
          tags: info.tags,
          // function/method
          callees: "callees" in info ? info.callees : undefined,
          callDepth: "callDepth" in info ? info.callDepth : undefined,
          tests: "tests" in info ? info.tests : undefined,
          branchCoverage: "branchCoverage" in info ? info.branchCoverage : undefined,
          // class
          methodCount: "methodCount" in info ? info.methodCount : undefined,
          fieldCount: "fieldCount" in info ? info.fieldCount : undefined,
          // churn
          churn: "churn" in info ? info.churn : undefined,
          churnRisk: "churnRisk" in info ? info.churnRisk : undefined,
          coupledFiles: "coupledFiles" in info ? info.coupledFiles : undefined,
          // call-site
          callee: "callee" in info ? info.callee : undefined,
          // parameter
          validated: "validated" in info ? info.validated : undefined,
          // type/import
          usedBy: "usedBy" in info ? info.usedBy : undefined,
          fileName: currentFileName,
        });
      }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.click(); } }}
    >
      {children}
    </span>
  );
}
