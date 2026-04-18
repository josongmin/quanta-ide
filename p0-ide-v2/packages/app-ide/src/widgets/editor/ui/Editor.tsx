import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@quanta/ui-kit/lib";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { ORCHESTRATOR, ORCHESTRATOR_SOURCE } from "@quanta/app-ide/entities/file";
import { focusStore, useFocusStore } from "@quanta/app-ide/stores/focus-store";
import { symbolHover, SymbolPopup, type HoverAnchor } from "@quanta/app-ide/features/editor-symbol-hover";
import { callSiteHover, CallSitePopup, type CallSiteAnchor } from "@quanta/app-ide/features/editor-call-site-hover";
import { engineGutter } from "@quanta/app-ide/features/editor-gutter-marks";
import { fnHeaders } from "@quanta/app-ide/features/editor-fn-header";
import { fileHeader } from "@quanta/app-ide/features/editor-file-header";
import { RiskMinimap } from "@quanta/app-ide/features/editor-risk-minimap";
import { CanvasView } from "@quanta/app-ide/features/editor-canvas";
import { SecurityRulesView } from "@quanta/app-ide/features/security-rules";
import "./editor.css";

const initialTabs = [
  { name: "orchestrator.py", dirty: true },
  { name: "routing_policy.py", dirty: false },
  { name: "security.py", dirty: false },
];

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    backgroundColor: "var(--bg)",
    color: "var(--fg)",
  },
  ".cm-scroller": {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    lineHeight: "1.6",
    overflow: "auto",
  },
  ".cm-content": { padding: "12px 0" },
  ".cm-gutters": {
    backgroundColor: "var(--bg)",
    color: "var(--fg-subtle)",
    border: "none",
    fontSize: "11px",
    paddingLeft: "4px",
  },
  ".cm-gutterElement": {
    padding: "0 4px 0 0",
    minWidth: "16px",
    textAlign: "right",
    lineHeight: "1.6",
  },
  ".cm-lineNumbers": { paddingLeft: "0" },
  ".cm-lineNumbers .cm-gutterElement": {
    color: "var(--fg-subtle)",
    minWidth: "18px",
    padding: "0 4px 0 2px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--fg-muted)",
  },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--accent) 5%, transparent)" },
  ".cm-line": { padding: "0 16px 0 var(--cm-line-pad)" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
  },
  ".cm-cursor": { borderLeftColor: "var(--accent)" },
});


export function Editor() {
  const file = ORCHESTRATOR;
  const cmRef = useRef<ReactCodeMirrorRef | null>(null);

  const [tabs, setTabs] = useState(initialTabs);
  const [activeTab, setActiveTab] = useState(initialTabs[0].name);

  const closeTab = (name: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.name !== name);
      if (name === activeTab && next.length > 0) {
        const idx = prev.findIndex((t) => t.name === name);
        setActiveTab(next[Math.min(idx, next.length - 1)].name);
      }
      return next;
    });
  };

  const [symAnchor, setSymAnchor] = useState<HoverAnchor | null>(null);
  const [callAnchor, setCallAnchor] = useState<CallSiteAnchor | null>(null);
  const dismissTimer = useRef<number | null>(null);

  const cancelDismiss = () => {
    if (dismissTimer.current !== null) {
      window.clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  };
  const scheduleDismiss = () => {
    cancelDismiss();
    dismissTimer.current = window.setTimeout(() => {
      setSymAnchor(null);
      setCallAnchor(null);
      dismissTimer.current = null;
    }, 140);
  };

  const extensions = useMemo(
    () => [
      python(),
      EditorView.lineWrapping,
      engineGutter(file.gutter),
      lineNumbers(),
      fileHeader(file),
      fnHeaders(file.functionHeaders),
      ...callSiteHover(file.callSites, (a) => {
        if (a) {
          cancelDismiss();
          setCallAnchor(a);
          setSymAnchor(null);
        } else {
          scheduleDismiss();
        }
      }),
      ...symbolHover(file.symbols, (a) => {
        if (a) {
          cancelDismiss();
          setSymAnchor(a);
          setCallAnchor(null);
        } else {
          scheduleDismiss();
        }
      }),
    ],
    [file],
  );

  const viewMode = useFocusStore((s) => s.viewMode);
  const scrollToLine = useFocusStore((s) => s.scrollToLine);
  useEffect(() => {
    if (!scrollToLine) return;
    const view = cmRef.current?.view;
    if (!view) return;
    if (scrollToLine < 1 || scrollToLine > view.state.doc.lines) return;
    const lineObj = view.state.doc.line(scrollToLine);
    view.dispatch({
      selection: EditorSelection.cursor(lineObj.from),
      effects: EditorView.scrollIntoView(lineObj.from, { y: "center" }),
    });
    view.focus();
  }, [scrollToLine]);

  const jumpTo = (line: number) => focusStore.jumpTo(line);
  const openFlow = (pathId?: string) => {
    if (pathId) focusStore.openFlow(pathId);
    else focusStore.setMode("flow");
    setSymAnchor(null);
    setCallAnchor(null);
  };

  return (
    <main className="editor" aria-label="Editor">
      <div className="editor__tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.name}
            type="button"
            role="tab"
            aria-selected={t.name === activeTab}
            aria-label={t.name}
            className={cn("tab", t.name === activeTab && "tab--active")}
            onClick={() => setActiveTab(t.name)}
          >
            <span className="tab__name">{t.name}</span>
            <span
              className="tab__close"
              aria-hidden="true"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(t.name);
              }}
            >
              ×
            </span>
          </button>
        ))}
        <div className="tab__spacer" />
      </div>

      <div className="editor__canvas">
        {viewMode === "code" ? (
          <>
            <CodeMirror
              ref={cmRef}
              value={ORCHESTRATOR_SOURCE}
              theme={editorTheme}
              extensions={extensions}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: true,
                highlightActiveLineGutter: true,
                autocompletion: false,
                indentOnInput: false,
              }}
              className="editor__cm"
            />
            <RiskMinimap
              points={file.minimap}
              totalLines={ORCHESTRATOR_SOURCE.split("\n").length}
              onJump={jumpTo}
            />
          </>
        ) : viewMode === "security-rules" ? (
          <SecurityRulesView />
        ) : (
          <CanvasView file={file} />
        )}
        <div className="editor__view-toggle">
          <button
            type="button"
            className={cn("editor__view-btn", viewMode === "code" && "is-active")}
            onClick={() => focusStore.setViewMode("code")}
            title="Code view"
            aria-label="Code view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
          <button
            type="button"
            className={cn("editor__view-btn", viewMode === "canvas" && "is-active")}
            onClick={() => focusStore.setViewMode("canvas")}
            title="Canvas view"
            aria-label="Canvas view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 17h7M17.5 14v7" />
            </svg>
          </button>
        </div>
      </div>

      {symAnchor && (
        <SymbolPopup
          anchor={symAnchor}
          onMouseEnter={cancelDismiss}
          onMouseLeave={scheduleDismiss}
          onOpenFlow={() => openFlow(file.taintPaths[0]?.id)}
          onJumpLine={jumpTo}
        />
      )}
      {callAnchor && (
        <CallSitePopup
          anchor={callAnchor}
          onMouseEnter={cancelDismiss}
          onMouseLeave={scheduleDismiss}
          onOpenFlow={(pathId) => openFlow(pathId)}
        />
      )}
    </main>
  );
}
