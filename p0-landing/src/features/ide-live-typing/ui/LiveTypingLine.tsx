import { useCallback, useEffect, useRef } from "react";
import { useLiveTyping } from "../model/useLiveTyping";

const PLACEHOLDER = "if (amount > 0) {";
const DEBOUNCE_MS = 300;
const ANALYZE_MS = 800;

export function LiveTypingLine() {
  const { typedText, setTypedText, analysisState, setAnalysis, setDeltas, startEditing, reset } = useLiveTyping();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef(0);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTypedText(val);
    startEditing();
    setAnalysis("debouncing");

    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setAnalysis("analyzing");
      // fake analysis delay
      window.setTimeout(() => {
        // ">" changed to ">=" adds blast +6, taint +1
        const hasGte = val.includes(">=");
        setDeltas(hasGte ? 6 : 0, hasGte ? 1 : 0);
        setAnalysis("done");
      }, ANALYZE_MS);
    }, DEBOUNCE_MS);
  }, [setTypedText, setAnalysis, setDeltas, startEditing]);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);
      reset();
    };
  }, [reset]);

  return (
    <div className="livetype-wrap">
      <span className="ide-editor-lineno">8</span>
      <span className="ide-editor-gutter" data-risk="3" />
      <span className="ide-editor-fold" />
      <span className="ide-editor-code livetype-code">
        {"  "}
        <span className="kw">if</span>
        <span className="punct"> (</span>
        <input
          ref={inputRef}
          type="text"
          className="livetype-input"
          value={typedText || PLACEHOLDER}
          onChange={handleInput}
          onFocus={() => {
            if (!typedText) { setTypedText(PLACEHOLDER); }
          }}
          spellCheck={false}
          autoComplete="off"
        />
        <span className="punct">) {`{`}</span>
      </span>
      <span className="ide-editor-inline">
        {analysisState === "debouncing" && (
          <span className="delta">waiting…</span>
        )}
        {analysisState === "analyzing" && (
          <span className="delta">◐ analyzing</span>
        )}
        {analysisState === "done" && (
          <span className="warn">behavior change</span>
        )}
      </span>
    </div>
  );
}
