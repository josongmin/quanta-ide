import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { ORCHESTRATOR, ORCHESTRATOR_SOURCE } from "@/entities/file";
import { focusStore, useFocusStore } from "@/shared/model/focus-store";
import { symbolHover, SymbolPopup, type HoverAnchor } from "@/features/editor-symbol-hover";
import { callSiteHover, CallSitePopup, type CallSiteAnchor } from "@/features/editor-call-site-hover";
import { engineGutter } from "@/features/editor-gutter-marks";
import { fnHeaders } from "@/features/editor-fn-header";
import { fileHeader } from "@/features/editor-file-header";
import { RiskMinimap } from "@/features/editor-risk-minimap";
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
  ".cm-line": { padding: "0 16px 0 12px" },
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
      <div className="editor__tabs">
        {tabs.map((t) => (
          <button
            key={t.name}
            type="button"
            className={"tab" + (t.name === activeTab ? " tab--active" : "")}
            onClick={() => setActiveTab(t.name)}
          >
            <span className="tab__name">{t.name}</span>
            <span
              className="tab__close"
              role="button"
              aria-label="Close"
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
