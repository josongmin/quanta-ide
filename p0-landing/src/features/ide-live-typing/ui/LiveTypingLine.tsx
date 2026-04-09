import { useEffect, useRef, useState } from "react";
import { useLiveTyping } from "../model/useLiveTyping";

const DEBOUNCE_MS = 200;
const ANALYZE_MS = 600;

// Sample texts to cycle through
const SAMPLE_TEXTS = [
  "amount > threshold && user.role !== 'admin'",
  "if (amount >= 0) { processRefund(tx); }",
  "await ledger.write(tx);",
  "return { ok: true, refundId: tx.id };",
];

const TYPE_SPEED_MS = 14;   // ms per char while typing
const DELETE_SPEED_MS = 5;  // ms per char while deleting (faster)
const PAUSE_AFTER_MS = 2200; // pause before deleting
const PAUSE_BEFORE_MS = 500; // pause before typing next

export function LiveTypingLine() {
  const { setTypedText, setAnalysis, setDeltas, startEditing, reset } = useLiveTyping();
  const [displayText, setDisplayText] = useState("");
  const [sampleIdx, setSampleIdx] = useState(0);
  const phaseRef = useRef<"typing" | "pausing" | "deleting" | "waiting">("typing");
  const charIdxRef = useRef(0);
  const timerRef = useRef(0);
  const analyzeTimerRef = useRef(0);

  useEffect(() => {
    const currentSample = SAMPLE_TEXTS[sampleIdx];

    function tick() {
      if (phaseRef.current === "typing") {
        charIdxRef.current += 1;
        const next = currentSample.slice(0, charIdxRef.current);
        setDisplayText(next);
        setTypedText(next);

        if (charIdxRef.current === 1) {
          startEditing();
          setAnalysis("debouncing");
        }

        if (charIdxRef.current >= currentSample.length) {
          // Done typing — trigger analysis then pause
          window.clearTimeout(analyzeTimerRef.current);
          analyzeTimerRef.current = window.setTimeout(() => {
            setAnalysis("analyzing");
            analyzeTimerRef.current = window.setTimeout(() => {
              const hasGte = currentSample.includes(">=");
              setDeltas(hasGte ? 6 : 0, hasGte ? 1 : 0);
              setAnalysis("done");
            }, ANALYZE_MS);
          }, DEBOUNCE_MS);

          phaseRef.current = "pausing";
          timerRef.current = window.setTimeout(tick, PAUSE_AFTER_MS);
        } else {
          timerRef.current = window.setTimeout(tick, TYPE_SPEED_MS);
        }
      } else if (phaseRef.current === "pausing") {
        phaseRef.current = "deleting";
        tick();
      } else if (phaseRef.current === "deleting") {
        charIdxRef.current -= 1;
        const next = currentSample.slice(0, charIdxRef.current);
        setDisplayText(next);
        setTypedText(next);

        if (charIdxRef.current <= 0) {
          phaseRef.current = "waiting";
          timerRef.current = window.setTimeout(() => {
            setSampleIdx((i) => (i + 1) % SAMPLE_TEXTS.length);
          }, PAUSE_BEFORE_MS);
        } else {
          timerRef.current = window.setTimeout(tick, DELETE_SPEED_MS);
        }
      }
    }

    phaseRef.current = "typing";
    charIdxRef.current = 0;
    setDisplayText("");
    setAnalysis("idle");
    timerRef.current = window.setTimeout(tick, TYPE_SPEED_MS);

    return () => {
      window.clearTimeout(timerRef.current);
      window.clearTimeout(analyzeTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleIdx]);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);
      window.clearTimeout(analyzeTimerRef.current);
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
        <span className="livetype-display">{displayText}</span>
        <span className="livetype-cursor" />
      </span>
    </div>
  );
}
