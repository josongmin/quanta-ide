import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { EditorView } from "@codemirror/view";
import "./editor.css";

const sample = `class DeepReasoningOrchestrator:
    """Coordinates multi-step reasoning across analysis ports."""

    def __init__(self, strategy: Strategy, store: ExperienceStore) -> None:
        self._strategy = strategy
        self._store = store

    def execute(self, request: Request) -> Response:
        plan = self._strategy.select(request)
        trace = []
        for step in plan.steps:
            result = step.run(request.ctx)
            trace.append(result)
            if result.is_terminal():
                break
        self._store.save(trace)            # ← taint sink
        return Response(trace=trace, plan=plan)

    def _select_strategy(self, kind: str) -> Strategy:
        if kind == "fast":
            return self._strategy.fast
        return self._strategy.deep
`;

const tabs = [
  { name: "orchestrator.py", dirty: true, active: true },
  { name: "routing_policy.py", dirty: false, active: false },
  { name: "security.py", dirty: false, active: false },
];

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    fontFamily: "var(--font-mono)",
    backgroundColor: "var(--bg)",
    color: "var(--fg)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.6",
    overflow: "auto",
  },
  ".cm-content": { padding: "12px 0" },
  ".cm-gutters": {
    backgroundColor: "var(--bg)",
    color: "var(--fg-subtle)",
    border: "none",
    fontSize: "10px",
  },
  ".cm-gutterElement": {
    padding: "0 12px 0 12px",
    minWidth: "32px",
    textAlign: "right",
  },
  ".cm-lineNumbers .cm-gutterElement": { color: "var(--fg-subtle)" },
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
  return (
    <main className="editor" aria-label="Editor">
      <div className="editor__tabs">
        {tabs.map((t) => (
          <div key={t.name} className={"tab" + (t.active ? " tab--active" : "")}>
            <span className="tab__name">{t.name}</span>
            {t.dirty && <span className="tab__dirty" aria-label="unsaved">●</span>}
            <button className="tab__close" aria-label="닫기">×</button>
          </div>
        ))}
        <div className="tab__spacer" />
      </div>

      <div className="editor__canvas">
        <CodeMirror
          value={sample}
          theme={editorTheme}
          extensions={[python(), EditorView.lineWrapping]}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            autocompletion: false,
            indentOnInput: false,
          }}
          className="editor__cm"
        />
      </div>

    </main>
  );
}
