import { useCallback, useEffect, useMemo, useState } from "react";
import { useSceneStore } from "../store/scene-store";
import { interactionStore } from "../store/interaction-store";
import { useFeature } from "../store/feature-flags-store";
import { getAiService } from "../lib/ai-service-ref";
import { mockShaForSnapshot } from "../lib/mock-ai-service";
import type { NarrateCommitResult } from "../lib/ai-service";

// BisectGame (temporal.bisectGame)
// -----------------------------------------------------------------
// Gamified `git bisect` — the user describes the bug, we drive the
// canvas to the midpoint commit, and the user votes Yes (bug
// present) / No / Skip. Each answer halves the range; the terminal
// state prints the commit the bug was introduced at along with the
// AI narration of that commit's delta.
//
// The range is a [lo, hi] pair of snapshot indices; hi is known
// bad, lo is known good. Yes → hi := mid. No → lo := mid. Skip →
// move one step away from the current probe without shrinking.
//
// Bracket animation: the bracket div uses a CSS transition on
// width/left so each bisect step visually "snaps shut" rather than
// jumping — matching the "micro-animation" requirement.

const BISECT_OPEN_EVENT = "temporal-bisect-toggle";

export function openBisectGame(): void {
  window.dispatchEvent(new CustomEvent(BISECT_OPEN_EVENT, { detail: true }));
}

interface BisectState {
  lo: number;        // known-good index (inclusive)
  hi: number;        // known-bad index (inclusive)
  mid: number;       // current probe
  steps: number;
  done: boolean;
  culprit: number | null;
}

export function BisectGame() {
  const enabled = useFeature("temporal.bisectGame");
  const graph = useSceneStore(s => s.graph);
  const history = graph?.history;
  const [open, setOpen] = useState(false);
  const [bug, setBug] = useState("");
  const [state, setState] = useState<BisectState | null>(null);
  const [narration, setNarration] = useState<NarrateCommitResult | null>(null);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setOpen(typeof detail === "boolean" ? detail : v => !v);
    };
    window.addEventListener(BISECT_OPEN_EVENT, onEvent);
    return () => window.removeEventListener(BISECT_OPEN_EVENT, onEvent);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const total = history?.snapshots.length ?? 0;

  const start = useCallback(() => {
    if (!history || total < 2) return;
    const lo = 0;
    const hi = total - 1;
    const mid = Math.floor((lo + hi) / 2);
    setState({ lo, hi, mid, steps: 0, done: false, culprit: null });
    interactionStore.setTemporalMode("live");
    interactionStore.setSnapshotIndex(mid);
  }, [history, total]);

  // Fetch narration when the probe changes.
  useEffect(() => {
    if (!state || !history || !graph) return;
    const idx = state.done && state.culprit !== null ? state.culprit : state.mid;
    const sha = mockShaForSnapshot(history, idx);
    if (!sha) return;
    let disposed = false;
    (async () => {
      const ai = getAiService();
      const n = await ai.narrateCommit({ sha, graph, history });
      if (!disposed) setNarration(n);
    })();
    return () => { disposed = true; };
  }, [state, history, graph]);

  const answer = useCallback((verdict: "yes" | "no" | "skip") => {
    if (!state) return;
    let { lo, hi, mid, steps } = state;
    let done = false;
    let culprit: number | null = null;
    if (verdict === "yes") {
      // Bug already present here — the introduction is at or before mid.
      hi = mid;
    } else if (verdict === "no") {
      // Bug not yet present — introduction is after mid.
      lo = mid;
    } else {
      // Skip: move probe by 1 toward the nearer bound without shrinking.
      const nextMid = mid + (hi - mid > mid - lo ? 1 : -1);
      if (nextMid > lo && nextMid < hi) mid = nextMid;
    }
    steps += 1;
    if (hi - lo <= 1 && verdict !== "skip") {
      done = true;
      culprit = hi;
    } else if (verdict !== "skip") {
      mid = Math.floor((lo + hi) / 2);
    }
    const next: BisectState = { lo, hi, mid, steps, done, culprit };
    setState(next);
    if (history) {
      const idx = done && culprit !== null ? culprit : mid;
      interactionStore.setSnapshotIndex(idx);
    }
  }, [state, history]);

  const reset = useCallback(() => {
    setState(null);
    setNarration(null);
  }, []);

  // Bracket progress (0..1): fraction of the original search space
  // that's been eliminated.
  const bracketFraction = useMemo(() => {
    if (!state) return 0;
    const span = state.hi - state.lo;
    const initial = (history?.snapshots.length ?? 1) - 1;
    if (initial === 0) return 1;
    return 1 - span / initial;
  }, [state, history]);

  if (!enabled || !open) return null;

  return (
    <div role="dialog" aria-label="Bisect game" style={modalBackdropStyle} onClick={() => setOpen(false)}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Bisect game</span>
          <button type="button" onClick={() => setOpen(false)} style={closeBtnStyle}>×</button>
        </div>

        <div style={modalBodyStyle}>
          {!state && (
            <>
              <label style={labelStyle}>
                <span style={labelHeadStyle}>Describe the bug</span>
                <textarea
                  value={bug}
                  onChange={e => setBug(e.target.value)}
                  placeholder="Login fails after redirect"
                  style={{ ...inputStyle, height: 80, resize: "vertical" }}
                />
              </label>
              <SampleBugHints onPick={text => setBug(text)} />
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setOpen(false)} style={ghostBtnStyle}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={start}
                  disabled={!history || total < 2}
                  style={{ ...primaryBtnStyle, opacity: !history || total < 2 ? 0.55 : 1 }}
                >
                  Start bisect
                </button>
              </div>
              {(!history || total < 2) && (
                <div style={hintStyle}>This graph does not carry enough history to bisect.</div>
              )}
            </>
          )}

          {state && history && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, opacity: 0.7 }}>
                  Step {state.steps} · span {state.hi - state.lo} commit{state.hi - state.lo === 1 ? "" : "s"}
                </span>
              </div>

              <Bracket lo={state.lo} hi={state.hi} mid={state.done ? state.culprit ?? state.mid : state.mid} total={total} />

              <div style={progressWrapStyle}>
                <div style={{ ...progressFillStyle, width: `${Math.min(100, Math.round(bracketFraction * 100))}%` }} />
              </div>

              {!state.done && (
                <>
                  <div style={{ fontSize: 12 }}>
                    Is the bug present at{" "}
                    <strong>{history.snapshots[state.mid]?.message ?? history.snapshots[state.mid]?.label ?? `#${state.mid}`}</strong>
                    {history.snapshots[state.mid]?.author && (
                      <span style={{ opacity: 0.6, marginLeft: 6 }}>
                        · {history.snapshots[state.mid]?.author}
                      </span>
                    )}?
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => answer("yes")} style={yesBtnStyle}>
                      Yes (bug present)
                    </button>
                    <button type="button" onClick={() => answer("no")} style={noBtnStyle}>
                      No (clean)
                    </button>
                    <button type="button" onClick={() => answer("skip")} style={ghostBtnStyle}>
                      Skip
                    </button>
                  </div>
                </>
              )}

              {state.done && state.culprit !== null && (
                <div style={{
                  padding: "8px 10px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: 4,
                  fontSize: 12,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    Found it: {history.snapshots[state.culprit]?.message ?? history.snapshots[state.culprit]?.label} introduced the bug.
                  </div>
                  {bug && <div style={{ opacity: 0.8, fontStyle: "italic" }}>{bug}</div>}
                </div>
              )}

              {narration && (
                <>
                  <div style={{ ...sectionLabelStyle, marginTop: 6 }}>Commit narration</div>
                  <div style={{ lineHeight: 1.55, color: "#cbd5e1" }}>{narration.summary}</div>
                  {narration.highlights.length > 0 && (
                    <ul style={{ paddingLeft: 18, margin: 0, color: "#cbd5e1" }}>
                      {narration.highlights.map(h => <li key={h}>{h}</li>)}
                    </ul>
                  )}
                </>
              )}

              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
                <button type="button" onClick={reset} style={ghostBtnStyle}>
                  Restart
                </button>
                <button type="button" onClick={() => setOpen(false)} style={primaryBtnStyle}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Demo-friendly bug suggestions. Real bisect is unprejudiced (we don't
// actually evaluate the text — the user casts yes/no votes), but seeding
// realistic-sounding scenarios makes the "what should I type?" question
// evaporate.
const SAMPLE_BUGS: readonly string[] = [
  "Canvas stops rendering edges after opening inspector",
  "Film strip thumbnails flash black on scrub",
  "Dual split loses diff overlay at LOD change",
  "AI summary popover never dismisses on Esc",
];

function SampleBugHints({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: -2 }}>
      <span style={{ fontSize: 10, opacity: 0.6, alignSelf: "center" }}>try</span>
      {SAMPLE_BUGS.map(b => (
        <button
          key={b}
          type="button"
          onClick={() => onPick(b)}
          style={{
            background: "rgba(56, 189, 248, 0.14)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            color: "#7dd3fc",
            fontSize: 10.5,
            padding: "3px 8px",
            borderRadius: 999,
            cursor: "pointer",
            maxWidth: 210,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={b}
        >
          {b.length > 34 ? b.slice(0, 32) + "…" : b}
        </button>
      ))}
    </div>
  );
}

function Bracket({
  lo, hi, mid, total,
}: {
  lo: number; hi: number; mid: number; total: number;
}) {
  // Render an animated bracket: a range bar with [lo, hi] highlighted
  // and a diamond at `mid`. We transition the highlighted segment's
  // left/width so each answer collapses visually.
  const denom = Math.max(1, total - 1);
  const loPct = (lo / denom) * 100;
  const hiPct = (hi / denom) * 100;
  const midPct = (mid / denom) * 100;
  return (
    <div style={bracketTrackStyle}>
      <div
        style={{
          position: "absolute",
          left: `${loPct}%`,
          width: `${hiPct - loPct}%`,
          top: 0,
          bottom: 0,
          background: "rgba(56, 189, 248, 0.25)",
          border: "1px solid rgba(56, 189, 248, 0.5)",
          borderRadius: 4,
          transition: "left 320ms cubic-bezier(0.4, 0, 0.2, 1), width 320ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `calc(${midPct}% - 6px)`,
          top: "50%",
          transform: "translateY(-50%) rotate(45deg)",
          width: 10,
          height: 10,
          background: "#38bdf8",
          boxShadow: "0 0 6px rgba(56, 189, 248, 0.8)",
          transition: "left 320ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const modalBackdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 30,
};

const modalStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.98)",
  color: "#e2e8f0",
  borderRadius: 8,
  width: 460,
  maxWidth: "80vw",
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
  fontFamily: "system-ui, sans-serif",
  overflow: "hidden",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
};

const modalBodyStyle: React.CSSProperties = {
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  fontSize: 12,
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#94a3b8",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const labelHeadStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#94a3b8",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(148, 163, 184, 0.08)",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  borderRadius: 4,
  color: "#e2e8f0",
  padding: "6px 8px",
  fontSize: 12,
  outline: "none",
  fontFamily: "system-ui, sans-serif",
};

const primaryBtnStyle: React.CSSProperties = {
  background: "#38bdf8",
  border: "none",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 4,
  cursor: "pointer",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "rgba(148, 163, 184, 0.1)",
  border: "1px solid rgba(148, 163, 184, 0.3)",
  color: "#e2e8f0",
  fontSize: 11,
  padding: "6px 8px",
  borderRadius: 4,
  cursor: "pointer",
};

const yesBtnStyle: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.15)",
  border: "1px solid rgba(239, 68, 68, 0.5)",
  color: "#fca5a5",
  fontWeight: 600,
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 4,
  cursor: "pointer",
};

const noBtnStyle: React.CSSProperties = {
  background: "rgba(34, 197, 94, 0.15)",
  border: "1px solid rgba(34, 197, 94, 0.5)",
  color: "#86efac",
  fontWeight: 600,
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 4,
  cursor: "pointer",
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  fontStyle: "italic",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#94a3b8",
};

const bracketTrackStyle: React.CSSProperties = {
  position: "relative",
  height: 20,
  background: "rgba(148, 163, 184, 0.1)",
  borderRadius: 4,
  marginTop: 4,
};

const progressWrapStyle: React.CSSProperties = {
  height: 4,
  background: "rgba(148, 163, 184, 0.2)",
  borderRadius: 2,
  overflow: "hidden",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #38bdf8, #818cf8)",
  transition: "width 320ms cubic-bezier(0.4, 0, 0.2, 1)",
};
