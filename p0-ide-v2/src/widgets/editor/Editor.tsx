import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { ORCHESTRATOR, ORCHESTRATOR_SOURCE, focusStore, useFocusStore } from "@/entities/engine";
import { symbolHover, type HoverAnchor } from "./symbol-hover";
import { SymbolPopup } from "./SymbolPopup";
import { callSiteHover } from "./call-site-hover";
import { CallSitePopup, type CallSiteAnchor } from "./CallSitePopup";
import { engineGutter } from "./gutter-marks";
import { fnHeaders } from "./fn-header";
import { fileHeader } from "./file-header";
import { RiskMinimap } from "./RiskMinimap";
import "./editor.css";

const tabs = [
  { name: "orchestrator.py", dirty: true, active: true },
  { name: "routing_policy.py", dirty: false, active: false },
  { name: "security.py", dirty: false, active: false },
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
    fontSize: "12px",
    paddingLeft: "12px",
  },
  ".cm-gutterElement": {
    padding: "0 10px 0 0",
    minWidth: "22px",
    textAlign: "right",
    lineHeight: "1.6",
  },
  ".cm-lineNumbers": { paddingLeft: "2px" },
  ".cm-lineNumbers .cm-gutterElement": {
    color: "var(--fg-subtle)",
    minWidth: "20px",
    padding: "0 8px 0 4px",
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
          <div key={t.name} className={"tab" + (t.active ? " tab--active" : "")}>
            <span className="tab__name">{t.name}</span>
            <button className="tab__close" aria-label="닫기">×</button>
          </div>
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
